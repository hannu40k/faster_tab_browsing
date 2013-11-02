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

    var NS = "FasterTabBrowsing"; // Namespace
    let toggleCurrentTabFavorite = function() {
      let activeTab = tabBrowser.selectedTab;
      if (activeTab.hasAttributeNS(NS, "favoriteTab")) {
        // Is favorited
        console.log("favoriteTab removed!");
        activeTab.removeAttributeNS(NS, "favoriteTab");
      } else {
        // Is not favorited
        console.log("favoriteTab set!");
        activeTab.setAttributeNS(NS, "favoriteTab", 1);
      }

      // TODO! Set css for favorited tabs
    }

    let advanceFavoriteTabs = function(direction) {
      let i = tabBrowser.tabContainer.selectedIndex;
      do {
        i += direction;

        if (!tabBrowser.tabs[i]) // i went over tabs range
          i = (direction == -1) ? tabBrowser.visibleTabs.length-1 : 0;

        if (tabBrowser.tabs[i].hasAttributeNS(NS, "favoriteTab")) {
          tabBrowser.selectTabAtIndex(i);
          break;
        }
      } while(i != tabBrowser.tabContainer.selectedIndex);
      // Stops after one full loop around the tabs.
    }

    /* Hotkeys */

    let amount = require('sdk/simple-prefs').prefs['prefAmount'];
    let { Hotkey } = require("sdk/hotkeys");

    // Browse all tabs
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

    // Browse favorites
    let toggleFavoriteTab = Hotkey({
      combo: "control-Up",
      onPress: function() {
        toggleCurrentTabFavorite();
      }
    });
    let previousFavoriteTab = Hotkey({
      combo: "control-Left",
      onPress: function() {
        advanceFavoriteTabs(-1);
      }
    });
    let nextFavoriteTab = Hotkey({
      combo: "control-Right",
      onPress: function() {
        advanceFavoriteTabs(1);
      }
    });

    /* Preferences */

    // Preference listeners
    require("sdk/simple-prefs").on("prefAmount", function(prefName) {
      amount = require('sdk/simple-prefs').prefs[prefName];
    });
  }

  FasterTabBrowsing();
}