if (typeof FasterTabBrowsing == "undefined") {
  let FasterTabBrowsing = function() {
    let window = require("sdk/window/utils").getMostRecentBrowserWindow();
    let tabBrowser = require("sdk/tabs/utils").getTabBrowser(window);

    /* Fast advance all tabs */

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

    /* Tab favorites */

    // Get the normal font color of a tab from the first tab that is
    // not favorited. The color can not be hardcoded, because the color
    // varies, for example if the user has tree style tabs add-on.
    let origTabColor;
    for (let i = tabBrowser.visibleTabs.length - 1; i >= 0; i--) {
      if (!tabBrowser.tabs[i].hasAttributeNS(NS, "favoriteTab")) {
        origTabColor = tabBrowser.tabs[i].style.color;
        break;
      }

      // In case somebody decided to favorite all tabs, lets choose a default
      // tab color for him/her...
      origTabColor = "#ACBBBF";
    }

    let NS = "FasterTabBrowsing"; // Namespace
    let favTabColor = require('sdk/simple-prefs').prefs['prefFavTabFontColor'];
    let toggleCurrentTabFavorite = function() {
      let activeTab = tabBrowser.selectedTab;
      if (activeTab.hasAttributeNS(NS, "favoriteTab")) {
        // Remove from favorites
        activeTab.removeAttributeNS(NS, "favoriteTab");
        activeTab.style.color = origTabColor;
      } else {
        // Add to favorites
        activeTab.setAttributeNS(NS, "favoriteTab", 1);
        activeTab.style.color = favTabColor;
      }
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

    let { Hotkey } = require("sdk/hotkeys");
    let preferences = require('sdk/simple-prefs');

    let formHotkeys = function() {
      let prefs = preferences.prefs; // Get variables of preferences
      
      // Browse all tabs
      let advanceTabsBackwards = Hotkey({
        combo: prefs['prefBrowseTabsAccel']+"-"+prefs['prefBrowseTabsKeyBw'],
        onPress: function() {
          advanceTabsBy(-prefs['prefAmount']);
        }
      });

      let advanceTabsForward = Hotkey({
        combo: prefs['prefBrowseTabsAccel']+"-"+prefs['prefBrowseTabsKeyFw'],
        onPress: function() {
          advanceTabsBy(prefs['prefAmount']);
        }
      });

      // Browse favorites
      let toggleFavoriteTab = Hotkey({
        combo: prefs['prefFavTabsAccel']+"-"+prefs['prefToggleFav'],
        onPress: function() {
          toggleCurrentTabFavorite();
        }
      });
      let previousFavoriteTab = Hotkey({
        combo: prefs['prefFavTabsAccel']+"-"+prefs['prefFavTabsKeyBw'],
        onPress: function() {
          advanceFavoriteTabs(-1);
        }
      });
      let nextFavoriteTab = Hotkey({
        combo: prefs['prefFavTabsAccel']+"-"+prefs['prefFavTabsKeyFw'],
        onPress: function() {
          advanceFavoriteTabs(1);
        }
      });

      // Return the Hotkeys, because they have to be destroyed elsewhere
      // if a key is updated in the preferences.
      return [
        advanceTabsBackwards,
        advanceTabsForward,
        toggleFavoriteTab,
        previousFavoriteTab,
        nextFavoriteTab
      ];
    }

    let activeHotkeys = formHotkeys();

    /* Preferences */

    // Updating Hotkeys.
    // Too many variables to observe, so just update always, it is done
    // very rarely any way. Eases maintainability.
    preferences.on("", function(prefName) {
      // Remove all previously created hotkeys. Otherwise, if a key is
      // updated in preferences, it does not update the Hotkey, but instead
      // creates a new Hotkey, resulting in two keys for the same action.
      for (let i = activeHotkeys.length - 1; i >= 0; i--)
        activeHotkeys[i].destroy();
      activeHotkeys = formHotkeys();
    });

    preferences.on("prefFavTabFontColor", function(prefName) {
      favTabColor = preferences.prefs[prefName];
      // Update new color to all favorited tabs.
      for (let i = tabBrowser.visibleTabs.length - 1; i >= 0; i--) {
        if (tabBrowser.tabs[i].hasAttributeNS(NS, "favoriteTab"))
          tabBrowser.tabs[i].style.color = favTabColor;
      }
    });
  }

  FasterTabBrowsing();
}