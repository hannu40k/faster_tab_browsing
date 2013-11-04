if (typeof FasterTabBrowsing == "undefined") {
  let FasterTabBrowsing = function() {
    let window = require("sdk/window/utils").getMostRecentBrowserWindow();
    let tabBrowser = require("sdk/tabs/utils").getTabBrowser(window);
    let preferences = require('sdk/simple-prefs');
    let prefs = preferences.prefs; // Get variables of preferences
    let NS = "FasterTabBrowsing"; // Namespace of custom attrs in tabs
    let FAVORITETAB = "favoriteTab" // Inserted into tab as attr, tags as a fav

    /* Fast advance all tabs */

    let advanceTabsBy = function(amount) {
      let activeInd = tabBrowser.tabContainer.selectedIndex;
      let newInd = activeInd + amount;
      let tabsLastInd = tabBrowser.tabs.length-1;

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

    // Get the normal font color of a tab. Get this before fav tabs are
    // loaded from storage upon browser start and updated to current tabs.
    let origTabColor = tabBrowser.tabs[0].style.color;

    // Load and identify favorited tabs.
    var ss = require("simple-storage");
    if (!ss.storage.favTabs) {
      ss.storage.favTabs = []; // Holds indexes of favorited tabs
    }
    else {
      ss.storage.favTabs.forEach(function(i) {
        if (tabBrowser.tabs[i]) {
          tabBrowser.tabs[i].setAttributeNS(NS, FAVORITETAB, 1);
          tabBrowser.tabs[i].style.color = prefs.prefFavTabFontColor;
        }
      });
    }

    let tabIsFavorite = function(tab) {
      return tab.hasAttributeNS(NS, FAVORITETAB) ? true : false;
    }

    let toggleTabFavorite = function(tab) {
      if (tabIsFavorite(tab)) {
        // Remove from favorites
        let (favPos = ss.storage.favTabs.indexOf(tab.tabindex)) {
          if (favPos > -1)
            ss.storage.favTabs.splice(favPos, 1);
        }
        tab.removeAttributeNS(NS, FAVORITETAB);
        tab.style.color = origTabColor;
      } else {
        // Add to favorites. Private tabs are not put in storage.
        if (ss.storage.favTabs.indexOf(tab.tabindex) == -1
            || !require("private-browsing").isPrivate(tab))
          ss.storage.favTabs.push(tab.tabindex);
        tab.setAttributeNS(NS, FAVORITETAB, 1);
        tab.style.color = prefs.prefFavTabFontColor;
      }
    }

    let advanceFavoriteTabs = function(direction) {
      let startIndex = tabBrowser.tabContainer.selectedIndex;
      let i = startIndex;
      do {
        i += direction;

        if (!tabBrowser.tabs[i]) // i went over tabs range
          i = (direction == -1) ? tabBrowser.tabs.length-1 : 0;

        if (tabIsFavorite(tabBrowser.tabs[i])) {
          tabBrowser.selectTabAtIndex(i);
          break;
        }
      } while(i != startIndex);
      // Stops after one full loop around the tabs.
    }

    /* Hotkeys */

    let { Hotkey } = require("sdk/hotkeys");

    let formHotkeys = function() {      
      // Browse all tabs
      let advanceTabsBackwards = Hotkey({
        combo: prefs.prefBrowseTabsAccel+"-"+prefs.prefBrowseTabsKeyBw,
        onPress: function() { advanceTabsBy(-prefs.prefAmount); }
      });

      let advanceTabsForward = Hotkey({
        combo: prefs.prefBrowseTabsAccel+"-"+prefs.prefBrowseTabsKeyFw,
        onPress: function() { advanceTabsBy(prefs.prefAmount); }
      });

      // Browse favorites
      let toggleFavoriteTab = Hotkey({
        combo: prefs.prefFavTabsAccel+"-"+prefs.prefToggleFav,
        onPress: function() { toggleTabFavorite(tabBrowser.selectedTab); }
      });
      let previousFavoriteTab = Hotkey({
        combo: prefs.prefFavTabsAccel+"-"+prefs.prefFavTabsKeyBw,
        onPress: function() { advanceFavoriteTabs(-1); }
      });
      let nextFavoriteTab = Hotkey({
        combo: prefs.prefFavTabsAccel+"-"+prefs.prefFavTabsKeyFw,
        onPress: function() { advanceFavoriteTabs(1); }
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
    // very rarely anyway. Eases maintainability.
    preferences.on("", function(prefName) {
      // Remove all previously created hotkeys. Otherwise, if a key is
      // updated in preferences, it does not update the Hotkey, but instead
      // creates a new Hotkey, resulting in two keys for the same action.
      for (let i = activeHotkeys.length - 1; i >= 0; i--)
        activeHotkeys[i].destroy();
      activeHotkeys = formHotkeys();
    });

    preferences.on("prefFavTabFontColor", function(prefName) {
      // Update new color to all favorited tabs.
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--) {
        if (tabIsFavorite(tabBrowser.tabs[i]))
          tabBrowser.tabs[i].style.color = prefs.prefFavTabFontColor;
      }
    });

    // Listening to tab movement is difficult because of a bug in sdk/tabs
    // (bugs #689215 and #715560),
    // therefore use this function to rebuild the storage from visible tabs
    // and the custom attribute set in tabs to identify favs.
    let clearAndUpdateFavsToStorage = function() {
      ss.storage.favTabs = [];
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--) {
        if (tabIsFavorite(tabBrowser.tabs[i])
            && !require("private-browsing").isPrivate(tabBrowser.tabs[i]))
          ss.storage.favTabs.push(i);
      }
      console.log("saved!");
    }

    // When current window is closed, save locations of a all favorited
    // tabs to storage. Normally fav tab location is not updated to storage
    // when the tab is moved around, this clears and updates the storage.
    // However, listening to this event seems to fire almost completely
    // randomly when attempting to close the browser.
    // As a fail-safe, setInterval is used also.
    require("sdk/system/events").on("quit-application-requested", function() {
      clearAndUpdateFavsToStorage();
    });

    // Update favorited tabs to storage periodically, because listening
    // to quit-application-requested cannot be trusted to fire 100% of
    // the time. Save is performed once a minute.
    require("sdk/timers").setInterval(function() {
      clearAndUpdateFavsToStorage();
    }, 10000);
  }
  FasterTabBrowsing();
}