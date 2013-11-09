if (typeof FasterTabBrowsing == "undefined") {
  let FasterTabBrowsing = function() {
    let window = require("sdk/window/utils").getMostRecentBrowserWindow();
    let tabBrowser = require("sdk/tabs/utils").getTabBrowser(window);
    let { Hotkey } = require("sdk/hotkeys");
    let { storage } = require("simple-storage");
    let preferences = require('sdk/simple-prefs');
    let prefs = preferences.prefs; // Get variables of preferences
    let NS = "FasterTabBrowsing"; // Namespace of custom attrs in tabs
    let FAVORITETAB = "favoriteTab" // Inserted into tab as attr, tags as a fav

    // Get the normal colors of a tab. Get this before fav tabs are
    // loaded from storage upon browser start and updated to current tabs.
    let tabOrigColor = tabBrowser.tabs[0].style.color;
    let tabOrigShadow = tabBrowser.tabs[0].style.textShadow;

    let tabIsFavorite = function(tab) {
      return tab.hasAttributeNS(NS, FAVORITETAB) ? true : false;
    }

    let toggleTabStyle = function(tab, isFavorite) {
      if (isFavorite) {
        tab.style.color = tabOrigColor;
        tab.style.textShadow = tabOrigShadow;
      }
      else {
        tab.style.color = prefs.prefFavTabFontColor;
        let rgb = hexToRgb(prefs.prefFavTabShadowColor);
        rgb = "0px 0px 5px rgba("+rgb.r+", "+rgb.g+", "+rgb.b+", 1)";
        tab.style.textShadow = rgb;
      }
    }

    // Load and identify favorited tabs.
    if (!storage.favTabs) {
      storage.favTabs = []; // Holds indexes of favorited tabs
    }
    else {
      storage.favTabs.forEach(function(i) {
        if (tabBrowser.tabs[i]) 
          toggleTabFavorite(tabBrowser.tabs[i]);
      });
    }

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

    // Notation -> available already when loading favs from storage.
    function toggleTabFavorite(tab) {
      if (tabIsFavorite(tab)) {
        // Remove from favorites
        let (favPos = storage.favTabs.indexOf(tab.tabindex)) {
          if (favPos > -1)
            storage.favTabs.splice(favPos, 1);
        }
        tab.removeAttributeNS(NS, FAVORITETAB);
        toggleTabStyle(tab, true);
      } else {
        // Add to favorites. Private tabs are not put in storage.
        if (storage.favTabs.indexOf(tab.tabindex) == -1
            && !require("private-browsing").isPrivate(tab))
          storage.favTabs.push(tab.tabindex);
        tab.setAttributeNS(NS, FAVORITETAB, 1);
        toggleTabStyle(tab, false);
      }
    }

    let advanceFavoriteTabs = function(direction) {
      let startIndex = tabBrowser.tabContainer.selectedIndex;
      let i = startIndex + direction;
      do {
        if (!tabBrowser.tabs[i]) // i went over tabs range
          i = (direction == -1) ? tabBrowser.tabs.length-1 : 0;

        if (tabIsFavorite(tabBrowser.tabs[i])) {
          tabBrowser.selectTabAtIndex(i);
          break;
        }
        i += direction;
      } while(i != startIndex);
      // Stops after one full loop around the tabs.
    }

    function hexToRgb(hex) {
      // source http://stackoverflow.com/a/5624139/1201945
      let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    }

    /* Hotkeys */

    let formHotkeys = function() {      
      let hotkeys = [
        { combo: prefs.prefBrowseTabsAccel+"-"+prefs.prefBrowseTabsKeyBw,
          onPress: function() { advanceTabsBy(-prefs.prefAmount); }},
        { combo: prefs.prefBrowseTabsAccel+"-"+prefs.prefBrowseTabsKeyFw,
          onPress: function() { advanceTabsBy(prefs.prefAmount); }},
        { combo: prefs.prefFavTabsAccel+"-"+prefs.prefToggleFav,
          onPress: function() { toggleTabFavorite(tabBrowser.selectedTab); }},
        { combo: prefs.prefFavTabsAccel+"-"+prefs.prefFavTabsKeyBw,
        onPress: function() { advanceFavoriteTabs(-1); }},
        { combo: prefs.prefFavTabsAccel+"-"+prefs.prefFavTabsKeyFw,
        onPress: function() { advanceFavoriteTabs(1); }}
      ];

      for (let i = hotkeys.length - 1; i >= 0; i--)
        hotkeys[i] = Hotkey(hotkeys[i]);

      return hotkeys;
    }

    let hotkeys = formHotkeys();

    /* Preferences */

    // Updating Hotkeys.
    // Too many variables to observe, so just update always, it is done
    // very rarely anyway. Eases maintainability.
    preferences.on("", function(prefName) {
      // Remove all previously created hotkeys. Otherwise, if a key is
      // updated in preferences, it does not update the Hotkey, but instead
      // creates a new Hotkey, resulting in two keys for the same action.
      for (let i = hotkeys.length - 1; i >= 0; i--)
        hotkeys[i].destroy();
      hotkeys = formHotkeys();
    });

    // Update new color to all favorited tabs on color change.
    preferences.on("prefFavTabFontColor", function(prefName) {
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--)
        if (tabIsFavorite(tabBrowser.tabs[i]))
          toggleTabStyle(tabBrowser.tabs[i]);
    });
    preferences.on("prefFavTabShadowColor", function(prefName) {
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--)
        if (tabIsFavorite(tabBrowser.tabs[i]))
          toggleTabStyle(tabBrowser.tabs[i]);
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

    let removeAllFavorites = function() {
      // Clear storage also because tab layout might have changed when
      // enabled again.
      storage.favTabs = [];
      for (let i = tabBrowser.tabs.length - 1; i >= 0; i--) {
        if (tabIsFavorite(tabBrowser.tabs[i]))
          toggleTabFavorite(tabBrowser.tabs[i])
      }
    }

    exports.onUnload = function (reason) {
      switch(reason) {
        case "shutdown": clearAndUpdateFavsToStorage(); break;
        case "disable": // Fall-thru
        case "uninstall": removeAllFavorites(); break;
      }
      // Note: "uninstall" doesn't work currently, bug #627432.
    }

    // Update favorited tabs to storage periodically in case of crashes.
    require("sdk/timers").setInterval(function() {
      clearAndUpdateFavsToStorage();
    }, 60000);
  }
  FasterTabBrowsing();
}