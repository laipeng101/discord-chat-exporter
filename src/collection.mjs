import { CHANNEL_WELCOME_SELECTOR } from './dom-reader.mjs';

const COLLECTION_STALL_MS = 12000;
const LATEST_SETTLE_MS = 4500;
const PAGINATION_ATTEMPTS = [
  { depth: 0.65, pivotDwellMs: 800, settleMs: 800 },
  { depth: 0.32, pivotDwellMs: 1200, settleMs: 1600 },
  { depth: 0.80, pivotDwellMs: 2000, settleMs: 3200 },
  { depth: 0.90, pivotDwellMs: 3200, settleMs: 6400 },
  { depth: 0.96, pivotDwellMs: 4800, settleMs: 12000 },
  { depth: 0.50, pivotDwellMs: 12000, settleMs: 12000 },
  { depth: 0.65, pivotDwellMs: 24000, settleMs: 12000 }
];
const SCROLL_STEP_RATIO = 0.72;

function isAtTop(scroller) {
  return scroller.scrollTop <= 3;
}

function isAtBottom(scroller) {
  return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scrollSignature(scroller, scan) {
  const first = scan.ids[0] || '';
  const last = scan.ids[scan.ids.length - 1] || '';
  return `${first}:${last}:${Math.round(scroller.scrollTop)}:${scroller.scrollHeight}:${scroller.clientHeight}`;
}

function moveScroller(scroller, direction) {
  const distance = Math.max(1, Math.floor(scroller.clientHeight * SCROLL_STEP_RATIO));
  scroller.scrollBy({ top: direction * distance, left: 0, behavior: 'auto' });
}

function jumpToLoadedEdge(scroller, direction) {
  scroller.scrollTop = direction < 0 ? 0 : Math.max(0, scroller.scrollHeight - scroller.clientHeight);
}

function hasChannelBeginning(root) {
  return Boolean(root.querySelector(
    `:scope > ${CHANNEL_WELCOME_SELECTOR}, :scope > [class*="channelBeginning"], :scope > [class*="channelStart"]`
  ));
}

function hasMessagePlaceholders(node) {
  return Boolean(node.querySelector(':scope > [class*="wrapper_"]:is([class*="cozy_"], [class*="compact_"])'));
}

function findPaginationBoundary(root, direction, rowId) {
  const older = direction < 0;
  let edgeMessage = older ? root.firstElementChild : root.lastElementChild;
  let hasPlaceholders = false;
  while (edgeMessage && !edgeMessage.id.startsWith('chat-messages-')) {
    hasPlaceholders ||= hasMessagePlaceholders(edgeMessage);
    edgeMessage = older ? edgeMessage.nextElementSibling : edgeMessage.previousElementSibling;
  }
  return hasPlaceholders && edgeMessage?.id === rowId ? edgeMessage : null;
}

function messageEdgePosition(scroller, edgeMessage, direction) {
  const messageRect = edgeMessage.getBoundingClientRect();
  return (direction < 0 ? messageRect.top : messageRect.bottom) -
    scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function advancePagination(scroller, edgeMessage, direction, state, now) {
  if (state.scroller !== scroller) {
    state.scroller = scroller;
    state.reenter = false;
    state.waitUntil = 0;
  }
  if (now < state.waitUntil) return true;

  const older = direction < 0;
  const viewport = scroller.clientHeight;
  const messageEdge = messageEdgePosition(scroller, edgeMessage, direction);
  const maxScrollTop = Math.max(0, scroller.scrollHeight - viewport);

  if (!state.reenter) {
    if (state.attempts >= PAGINATION_ATTEMPTS.length) return false;
    const firstAttempt = state.attempts++ === 0;
    const outsideTrigger = older ? scroller.scrollTop >= messageEdge
      : scroller.scrollTop + viewport <= messageEdge;
    if (!firstAttempt || !outsideTrigger) {
      const pivot = older ? Math.min(messageEdge + viewport, maxScrollTop)
        : Math.max(0, messageEdge - 2 * viewport);
      const canRearm = older ? pivot > messageEdge : pivot + viewport < messageEdge;
      if (canRearm) {
        // Stay outside the trigger to give Discord time to release a
        // pending request or reset its pagination state before retrying.
        scroller.scrollTop = pivot;
        state.reenter = true;
        state.waitUntil = now + PAGINATION_ATTEMPTS[state.attempts - 1].pivotDwellMs;
        return true;
      }
    }
  }

  // Mounted rows have already been scanned. Stop across the real row and
  // placeholder while Discord loads, then require overlap on the next scan.
  const { depth, settleMs } = PAGINATION_ATTEMPTS[state.attempts - 1];
  const offset = viewport * (older ? depth : 1 - depth);
  const approach = Math.max(0, Math.min(messageEdge - offset, maxScrollTop));
  scroller.scrollTop = approach;
  state.reenter = false;
  state.waitUntil = now + settleMs;
  return true;
}

function isWaitingForLatest(root, scroller) {
  if (root.getAttribute('aria-busy') === 'true' ||
      scroller.getAttribute('aria-busy') === 'true' ||
      scroller.parentElement?.querySelector('[class*="jumpToPresentBar"]')) return true;

  // Discord can render a placeholder group after the last message while
  // filling newer history. Placeholders above it do not affect this edge.
  for (let node = root.lastElementChild; node && !node.id.startsWith('chat-messages-'); node = node.previousElementSibling) {
    if (node.matches('[role="progressbar"], [aria-busy="true"], [class*="spinner"]') ||
        hasMessagePlaceholders(node)) return true;
  }
  return false;
}

export function createCollector({
  getRoute, getDateBounds, getDelay, readView, setStatus, setRunning, complete,
  readTime = () => performance.now(), wait = sleep
}) {
  let activeJob = null;

  function initialTraversalDirection(scan, bounds) {
    if (scan.maxMs < bounds.startMs) return 1;
    if (scan.minMs >= bounds.endExclusiveMs) return -1;

    const missingStart = scan.minMs >= bounds.startMs;
    const missingEnd = scan.maxMs < bounds.endExclusiveMs;
    if (missingStart && missingEnd) {
      const distanceToStart = scan.minMs - bounds.startMs;
      const distanceToEnd = bounds.endExclusiveMs - scan.maxMs;
      return distanceToStart <= distanceToEnd ? -1 : 1;
    }
    if (missingStart) return -1;
    if (missingEnd) return 1;
    return 0;
  }

  async function startAutomaticCollection() {
    if (activeJob) return;

    const bounds = getDateBounds(true);
    const route = getRoute();

    if (!route) {
      setStatus('noChannel', {}, 'error');
      return;
    }
    if (!bounds) return;

    const job = { cancelled: false, routeKey: route.key };
    const interruption = () => {
      if (job.cancelled || activeJob !== job) return 'cancelled';
      return getRoute()?.key === job.routeKey ? '' : 'routeChanged';
    };
    activeJob = job;
    setRunning(true);

    const coverage = { '-1': 'pending', 1: 'pending' };
    const paginationByEdge = new Map();
    const delay = getDelay();
    const maximumSteps = 5000;
    let step = 0;
    let direction = 0;
    let observedMin = Infinity;
    let observedMax = -Infinity;
    let previousView = null;
    let missingSince = null;
    let lastProgressAt = readTime();
    let previousSignature = '';

    try {
      while (step < maximumSteps) {
        const stopped = interruption();
        if (stopped) {
          setStatus(stopped, {}, 'warning');
          return;
        }

        // Re-resolve the list after every wait. Discord can replace it while
        // loading or opening a thread, even without changing the URL.
        const scan = readView();
        const { scroller } = scan;
        const now = readTime();
        step += 1;

        const replaced = previousView && (scan.root !== previousView.root || scroller !== previousView.scroller);
        // Jumping to a message can replace the rows without replacing the list.
        const lostContinuity = previousView && !scan.ids.some((id) => previousView.ids.has(id));
        if (!scroller?.clientHeight || !scan.ids.length || lostContinuity) {
          missingSince ??= now;
          if (now - missingSince >= COLLECTION_STALL_MS) {
            if (previousView) setStatus('stalled', {}, 'warning');
            else if (scroller?.clientHeight) setStatus('noMessages', {}, 'warning');
            else setStatus('noScroller', {}, 'error');
            return;
          }
          setStatus('scanning');
          await wait(delay);
          continue;
        }

        if (missingSince !== null || replaced) previousSignature = '';
        missingSince = null;
        previousView = { root: scan.root, scroller, ids: new Set(scan.ids) };
        observedMin = Math.min(observedMin, scan.minMs);
        observedMax = Math.max(observedMax, scan.maxMs);
        // Multiple snowflakes can have the exact start millisecond.
        if (scan.minMs < bounds.startMs) coverage[-1] = 'covered';
        if (scan.maxMs >= bounds.endExclusiveMs) coverage[1] = 'covered';

        if (coverage[-1] === 'covered' && coverage[1] === 'covered') {
          const download = complete(() => !interruption());
          if (download) {
            await download;
            const interrupted = interruption();
            if (interrupted) setStatus(interrupted, {}, 'warning');
          }
          return;
        }

        direction ||= initialTraversalDirection(scan, bounds);
        if (coverage[direction] !== 'pending') direction = -direction;
        if (coverage[direction] !== 'pending') {
          setStatus('stalled', {}, 'warning');
          return;
        }

        const clippedStart = Math.max(bounds.startMs, Math.min(observedMin, bounds.endExclusiveMs));
        const clippedEnd = Math.min(bounds.endExclusiveMs, Math.max(observedMax, bounds.startMs));
        const covered = Math.max(0, clippedEnd - clippedStart);
        const percent = Math.max(0, Math.min(100, Math.round(
          (covered / (bounds.endExclusiveMs - bounds.startMs)) * 100
        )));
        const overlapsRange = scan.maxMs >= bounds.startMs && scan.minMs < bounds.endExclusiveMs;
        setStatus(overlapsRange ? 'collecting' : 'seeking', overlapsRange ? { percent } : {});

        const atEdge = direction < 0 ? isAtTop(scroller) : isAtBottom(scroller);
        const waitingForLatest = atEdge && direction > 0 && isWaitingForLatest(scan.root, scroller);
        const signature = `${direction}:${waitingForLatest}:${scrollSignature(scroller, scan)}`;
        if (signature !== previousSignature) {
          previousSignature = signature;
          lastProgressAt = now;
        }
        const stableFor = now - lastProgressAt;
        if (atEdge && (direction < 0
          ? hasChannelBeginning(scan.root) || scan.ids.includes(route.channelId)
          : !waitingForLatest && stableFor >= LATEST_SETTLE_MS)) {
          coverage[direction] = 'covered';
          continue;
        }

        const edgeId = direction < 0 ? scan.ids[0] : scan.ids.at(-1);
        const edgeKey = `${direction}:${edgeId}`;
        const boundary = findPaginationBoundary(scan.root, direction, `chat-messages-${route.channelId}-${edgeId}`);
        if (boundary) {
          let state = paginationByEdge.get(edgeKey);
          if (!state) {
            state = { attempts: 0, reenter: false, waitUntil: 0, scroller };
            paginationByEdge.set(edgeKey, state);
          }
          if (advancePagination(scroller, boundary, direction, state, now)) await wait(delay);
          else coverage[direction] = 'incomplete';
          continue;
        }

        if (stableFor >= COLLECTION_STALL_MS) {
          coverage[direction] = 'incomplete';
          continue;
        }

        if (atEdge) jumpToLoadedEdge(scroller, direction);
        else moveScroller(scroller, direction);
        await wait(delay);
      }

      setStatus(interruption() || 'stalled', {}, 'warning');
    } finally {
      if (activeJob === job) {
        activeJob = null;
        setRunning(false);
      }
    }
  }

  function cancelAutomaticCollection() {
    if (activeJob) activeJob.cancelled = true;
  }

  return { start: startAutomaticCollection, cancel: cancelAutomaticCollection };
}
