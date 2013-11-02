if (typeof FasterTabBrowsing == "undefined") {
  let FasterTabBrowsing = function() {
    let window = require("sdk/window/utils").getMostRecentBrowserWindow();
    let tabBrowser = require("sdk/tabs/utils").getTabBrowser(window);

    let advanceTabsBy = function(amount) {
      let activeInd = tabBrowser.tabContainer.selectedIndex;
      let newInd = activeInd + amount;
      let tabsLastInd = tabBrowser.visibleTabs.length-1;

      // When changing tabs, the active index will always stop once at either
      // the first index or the last index before changing to the other end
      // of available tabs.
      if (activeInd == 0 && newInd < 0)
        newInd = tabsLastInd; // jump to end of tabs
      else if (newInd < 0)
        newInd = 0; // stop at first index
      else if (activeInd == tabsLastInd && newInd > tabsLastInd)
        newInd = 0; // jump to beginning of tabs
      else if (newInd > tabsLastInd)
        newInd = tabsLastInd; // stop at last index
      
      tabBrowser.selectTabAtIndex(newInd);
    }

    let amount = require('sdk/simple-prefs').prefs['prefAmount'];
    let { Hotkey } = require("sdk/hotkeys");

    let advanceTabsBackwards = Hotkey({
      combo: "shift-PageUp",
      onPress: function() {
        advanceTabsBy(-amount);
      }
    });
    let advanceTabsForward = Hotkey({
      combo: "shift-PageDown",
      onPress: function() {
        advanceTabsBy(amount);
      }
    });

    require("sdk/simple-prefs").on("prefAmount", function(prefName) {
      amount = require('sdk/simple-prefs').prefs[prefName];
    });
  }

  FasterTabBrowsing();
}