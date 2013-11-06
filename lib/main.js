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
    let storage = require("simple-storage").storage;
    if (!storage.favTabs) {
      storage.favTabs = []; // Holds indexes of favorited tabs
    }
    else {
      storage.favTabs.forEach(function(i) {
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
        let (favPos = storage.favTabs.indexOf(tab.tabindex)) {
          if (favPos > -1)
            storage.favTabs.splice(favPos, 1);
        }
        tab.removeAttributeNS(NS, FAVORITETAB);
        tab.style.color = origTabColor;
      } else {
        // Add to favorites. Private tabs are not put in storage.
        if (storage.favTabs.indexOf(tab.tabindex) == -1
            && !require("private-browsing").isPrivate(tab))
          storage.favTabs.push(tab.tabindex);
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

    /* Saving favorites data to storage*/

    // Listening to tab movement is difficult because of a bug in sdk/tabs
    // (bugs #689215 and #715560),
    // therefore use this function to rebuild the storage from visible tabs
    // and the custom attribute set in tabs to identify favs.
    let clearAndUpdateFavsToStorage = function() {
      storage.favTabs = [];
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--) {
        if (tabIsFavorite(tabBrowser.tabs[i])
            && !require("private-browsing").isPrivate(tabBrowser.tabs[i]))
          storage.favTabs.push(i);
      }
    }

    // When current window is closed, save locations of a all favorited
    // tabs to storage. Normally fav tab location is not updated to storage
    // when the tab is moved around, this clears and updates the storage.
    // A bug in sdk/windows causes this to not fire when using ctrl + q
    // to close the browser. Works fine for Windows though with alt + f4.
    require("sdk/windows").browserWindows.on("close", function(window) {
      clearAndUpdateFavsToStorage();
    });
    // This sdk-api is at unstable status, but it seems to work well enough
    // for now (it didn't a short while ago). Also fires when pressing
    // ctrl + q on Linux! So at worst, favorites get saved twice. Will
    // fix this when one of these starts working at 100% certainty.
    require("sdk/system/events").on("quit-application-requested", function() {
      clearAndUpdateFavsToStorage();
    });

    // Update favorited tabs to storage periodically in case of crashes
    // and JUST in case those events above still fail to fire.
    require("sdk/timers").setInterval(function() {
      clearAndUpdateFavsToStorage();
    }, 60000);
  }
  FasterTabBrowsing();
}