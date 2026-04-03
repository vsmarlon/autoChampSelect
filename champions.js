/**
 * Champion data fetching and caching
 */

let playableCache = null;
let playableRequest = null;
let allCache = null;
let allRequest = null;

export async function getPlayableChampions(forceRefresh = false) {
    if (forceRefresh) {
        playableCache = null;
    }
    
    if (playableCache) {
        return playableCache;
    }
    
    if (playableRequest) {
        return playableRequest;
    }
    
    playableRequest = (async () => {
        try {
            const response = await fetch("/lol-champions/v1/owned-champions-minimal");
            
            if (!response.ok) {
                console.debug("[autoChampSelect] Failed to fetch playable champions:", response.status);
                return playableCache ?? [];
            }
            
            const data = await response.json();
            data.sort((a, b) => a.name.localeCompare(b.name));
            playableCache = data;
            return data;
        } catch (error) {
            console.debug("[autoChampSelect] Error fetching playable champions:", error);
            return playableCache ?? [];
        }
    })().finally(() => {
        playableRequest = null;
    });
    
    return playableRequest;
}

export async function getAllChampions() {
    if (allCache) {
        return allCache;
    }
    
    if (allRequest) {
        return allRequest;
    }
    
    allRequest = (async () => {
        try {
            const response = await fetch("/lol-game-data/assets/v1/champion-summary.json");
            
            if (!response.ok) {
                console.debug("[autoChampSelect] Failed to fetch all champions:", response.status);
                return allCache ?? [];
            }
            
            const data = await response.json();
            data.sort((a, b) => a.name.localeCompare(b.name));
            allCache = data;
            return data;
        } catch (error) {
            console.debug("[autoChampSelect] Error fetching all champions:", error);
            return allCache ?? [];
        }
    })().finally(() => {
        allRequest = null;
    });
    
    return allRequest;
}

export function clearPlayableCache() {
    playableCache = null;
}
