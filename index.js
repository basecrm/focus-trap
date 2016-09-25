var tabbable = require('tabbable');

var listeningFocusTrap = null;

function focusTrap(element, userOptions) {
  var tabbableNodes = [];
  var nodeFocusedBeforeActivation = null;
  var active = false;
  var containers = []

  var config = userOptions || {};
  config.returnFocusOnDeactivate = (userOptions && userOptions.returnFocusOnDeactivate != undefined)
    ? userOptions.returnFocusOnDeactivate
    : true;
  config.escapeDeactivates = (userOptions && userOptions.escapeDeactivates != undefined)
    ? userOptions.escapeDeactivates
    : true;
  config.preventOutsideClicks = (userOptions && userOptions.preventOutsideClicks != undefined)
    ? userOptions.preventOutsideClicks
    : true;

  var trap = {
    activate: activate,
    deactivate: deactivate,
    pause: removeListeners,
    unpause: addListeners,
  };

  return trap;

  function activate(activateOptions) {
    var defaultedActivateOptions = {
      onActivate: (activateOptions && activateOptions.onActivate !== undefined)
        ? activateOptions.onActivate
        : config.onActivate,
    };

    active = true;
    nodeFocusedBeforeActivation = document.activeElement;

    if (defaultedActivateOptions.onActivate) {
      defaultedActivateOptions.onActivate();
    }

    addListeners();
    tryFocus(firstFocusNode());
    return trap;
  }

  function deactivate(deactivateOptions) {
    var defaultedDeactivateOptions = {
      returnFocus: (deactivateOptions && deactivateOptions.returnFocus != undefined)
        ? deactivateOptions.returnFocus
        : config.returnFocusOnDeactivate,
      onDeactivate: (deactivateOptions && deactivateOptions.onDeactivate !== undefined)
        ? deactivateOptions.onDeactivate
        : config.onDeactivate,
    };

    removeListeners();

    if (defaultedDeactivateOptions.onDeactivate) {
      defaultedDeactivateOptions.onDeactivate();
    }

    if (defaultedDeactivateOptions.returnFocus) {
      setTimeout(function() {
        tryFocus(nodeFocusedBeforeActivation);
      }, 0);
    }

    active = false;
    return this;
  }

  function addListeners() {
    if (!active) return;

    // There can be only one listening focus trap at a time
    if (listeningFocusTrap) {
      listeningFocusTrap.pause();
    }
    listeningFocusTrap = trap;

    updateContainers();
    updateTabbableNodes();
    document.addEventListener('focus', checkFocus, true);
    document.addEventListener('click', checkClick, true);
    document.addEventListener('mousedown', checkPointerDown, true);
    document.addEventListener('touchstart', checkPointerDown, true);
    document.addEventListener('keydown', checkKey, true);

    return trap;
  }

  function removeListeners() {
    if (!active || !listeningFocusTrap) return;

    document.removeEventListener('focus', checkFocus, true);
    document.removeEventListener('click', checkClick, true);
    document.removeEventListener('mousedown', checkPointerDown, true);
    document.removeEventListener('touchstart', checkPointerDown, true);
    document.removeEventListener('keydown', checkKey, true);

    listeningFocusTrap = null;

    return trap;
  }

  function isChildNode(node) {
    return containers.some(function(container) {
      return container.contains(node)
    })
  }

  function firstFocusNode() {
    var node;

    if (!config.initialFocus) {
      // a child element is focused already (for example through autofocus)
      if (isChildNode(document.activeElement)) return;

      return tabbableNodes[0];
    }

    node = (typeof config.initialFocus === 'string')
      ? document.querySelector(config.initialFocus)
      : config.initialFocus;
    if (!node) {
      throw new Error('`initialFocus` refers to no known node');
    }

    return node;
  }

  // This needs to be done on mousedown and touchstart instead of click
  // so that it precedes the focus event
  function checkPointerDown(e) {
    if (config.clickOutsideDeactivates) {
      deactivate({ returnFocus: false });
    }
  }

  function checkClick(e) {
    if (config.clickOutsideDeactivates) return;
    updateContainers();
    if (isChildNode(e.target)) return;
    if (config.onOutsideClick) config.onOutsideClick(e)
    if (!config.preventOutsideClicks) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  function checkFocus(e) {
    updateContainers();
    if (isChildNode(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    // Checking for a blur method here resolves a Firefox issue (#15)
    if (typeof e.target.blur === 'function') e.target.blur();
  }

  function checkKey(e) {
    if (e.key === 'Tab' || e.keyCode === 9) {
      handleTab(e);
    }

    if (config.escapeDeactivates !== false && isEscapeEvent(e)) {
      deactivate();
    }
  }

  function handleTab(e) {
    e.preventDefault();
    updateContainers();
    updateTabbableNodes();
    var currentFocusIndex = tabbableNodes.indexOf(e.target);
    var lastTabbableNode = tabbableNodes[tabbableNodes.length - 1];
    var firstTabbableNode = tabbableNodes[0];

    if (e.shiftKey) {
      if (e.target === firstTabbableNode || tabbableNodes.indexOf(e.target) === -1) {
        return tryFocus(lastTabbableNode);
      }
      return tryFocus(tabbableNodes[currentFocusIndex - 1]);
    }

    if (e.target === lastTabbableNode) return tryFocus(firstTabbableNode);

    tryFocus(tabbableNodes[currentFocusIndex + 1]);
  }

  function updateContainers() {
    if (typeof element === 'string') {
      containers = document.querySelectorAll(element)
      containers = Array.prototype.slice.call(containers)
    } else if (typeof element === 'function') {
      containers = element()
    } else if (!Array.isArray(element)) {
      containers = [element]
    } else {
      containers = element
    }
  }

  function updateTabbableNodes() {
    var containersTabbables = containers.map(tabbable)
    tabbableNodes = Array.prototype.concat.apply([], containersTabbables);
  }
}

function isEscapeEvent(e) {
  return e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27;
}

function tryFocus(node) {
  if (!node || !node.focus) return;
  node.focus();
  if (node.tagName.toLowerCase() === 'input') {
    node.select();
  }
}

module.exports = focusTrap;
