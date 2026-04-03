/**
 * @name autoChampSelect
 * @author vsmarlon
 * @link https://github.com/vsmarlon/autoChampSelect
 * @description Auto pick/ban with ElainaV4-style architecture
 */

import * as config from "./config.js";
import * as champions from "./champions.js";
import * as ui from "./ui.js";

const VERSION = "3.0.0";
const DEBUG = false;
let sessionProcessing = false;
let pendingSession = null;
let latestChampSelectSession = null;
let currentGameflowPhase = null;

function log(...args) {
    if (DEBUG) {
        console.log("[select]", ...args);
    }
}

// ============ AUTO ACCEPT ============

async function handleReadyCheck() {
    if (!config.get("auto-accept")) return;
    
    log("Ready check detected, accepting in 2s...");
    await sleep(2000);
    
    // Re-check config after delay
    if (!config.get("auto-accept")) return;
    
    try {
        const response = await fetch("/lol-matchmaking/v1/ready-check/accept", { method: "POST" });
        if (response.ok) {
            log("Auto-accepted ready check");
        } else {
            log("Ready check accept failed", response.status);
        }
    } catch (error) {
        log("Failed to auto-accept:", error);
    }
}

// ============ CHAMP SELECT LOGIC ============

let declaredPickIntent = null;

async function queueChampSelectSession(session) {
    pendingSession = session;
    latestChampSelectSession = session;
    if (sessionProcessing) {
        return;
    }

    sessionProcessing = true;
    try {
        while (pendingSession) {
            const nextSession = pendingSession;
            pendingSession = null;
            await handleChampSelectSession(nextSession);
        }
    } finally {
        sessionProcessing = false;
    }
}

async function handleChampSelectSession(session) {
    if (!session) return;
    
    const pickEnabled = config.get("auto-pick");
    const banEnabled = config.get("auto-ban");
    const pickChampions = config.get("pick-champions");
    const banChampions = config.get("ban-champions");
    
    if (!pickEnabled && !banEnabled) return;
    
    const localCellId = session.localPlayerCellId;
    const allBans = [...session.bans.myTeamBans, ...session.bans.theirTeamBans];
    const allPicks = [...session.myTeam, ...session.theirTeam];
    const teamIntents = session.myTeam.map(p => p.championPickIntent);
    log("session", {
        localCellId,
        pickEnabled,
        banEnabled,
        pickChampions,
        banChampions,
        bans: allBans,
        intents: teamIntents,
        actions: session.actions.flat().filter((action) => action.actorCellId === localCellId).map((action) => ({
            id: action.id,
            type: action.type,
            completed: action.completed,
            isInProgress: action.isInProgress,
        })),
    });
    
    // Reset declared intent if our champ was banned
    if (declaredPickIntent && allBans.includes(declaredPickIntent)) {
        log(`Our pick intent ${declaredPickIntent} was banned`);
        declaredPickIntent = null;
    }
    
    // Declare pick intent early (hover before our turn)
    if (pickEnabled) {
        await declarePickIntent(session, localCellId, allBans, allPicks);
    }
    
    // Process active actions (when it's our turn)
    const myActions = session.actions.flat().filter(a => 
        a.actorCellId === localCellId && 
        !a.completed
    );
    
    const activeActions = myActions.filter(a => a.isInProgress);
    const actionsToProcess = activeActions.length > 0 ? activeActions : myActions;
    
    for (const action of actionsToProcess) {
        const isPick = action.type === "pick";
        const enabled = isPick ? pickEnabled : banEnabled;
        
        if (!enabled) {
            log("skipping disabled action", action.type, action.id);
            continue;
        }

        if (!action.isInProgress) {
            log("skipping non-active action", action.type, action.id);
            continue;
        }
        
        const championIds = isPick ? pickChampions : banChampions;
        const force = config.get(isPick ? "force-pick" : "force-ban");
        
        for (const championId of championIds) {
            if (!championId || championId === 0) continue;
            
            // Skip if banned
            if (allBans.includes(championId)) {
                log(`${action.type} ${championId} is banned, skipping`);
                continue;
            }
            
            // Skip if banning teammate's intent (unless force)
            if (!isPick && !force && teamIntents.includes(championId)) {
                log(`${championId} is teammate's intent, skipping ban`);
                continue;
            }
            
            // Skip if already picked (unless force)
            if (isPick && !force && allPicks.some(p => p.championId === championId)) {
                log(`${championId} already picked, skipping`);
                continue;
            }
            
            // Lock in
            log(`Locking in ${action.type}: ${championId}`);
            const response = await fetch(`/lol-champ-select/v1/session/actions/${action.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ championId, completed: true })
            });
            
            if (response.ok) {
                log(`Successfully locked ${action.type}: ${championId}`);
            } else {
                log(`Failed to lock ${action.type}:`, response.status);
            }
            
            break;
        }
    }
}

async function declarePickIntent(session, localCellId, allBans, allPicks) {
    const localPlayer = session.myTeam.find((player) => player.cellId === localCellId);
    const currentIntent = localPlayer?.championPickIntent ?? 0;
    const pickAction = session.actions.flat().find(a =>
        a.actorCellId === localCellId &&
        a.type === "pick" &&
        !a.completed
    );
    
    if (!pickAction) {
        log("No pending pick action found for intent declaration");
        return;
    }

    if (pickAction.isInProgress) {
        log("Skipping intent declaration because pick action is already active", pickAction.id);
        return;
    }
    
    const championIds = config.get("pick-champions");
    const force = config.get("force-pick");
    
    for (const championId of championIds) {
        if (!championId || championId === 0) continue;
        if (allBans.includes(championId)) {
            log("Skipping intent candidate because champion is banned", championId);
            continue;
        }
        if (!force && allPicks.some(p => p.championId === championId)) {
            log("Skipping intent candidate because champion is already picked", championId);
            continue;
        }
        if (currentIntent === championId || declaredPickIntent === championId) {
            log("Intent already set to desired champion", championId);
            return;
        }
        
        log(`Declaring pick intent: ${championId}`);
        const response = await fetch(`/lol-champ-select/v1/session/actions/${pickAction.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ championId, completed: false })
        });
        
        if (response.ok) {
            declaredPickIntent = championId;
            log(`Pick intent declared: ${championId}`);
        } else {
            log("Pick intent failed", response.status, championId);
        }
        
        return;
    }

    log("No valid champion found for intent declaration", championIds);
}

// ============ GAMEFLOW HANDLER ============

async function handleGameflowPhase(phase) {
    currentGameflowPhase = phase;
    ui.setPhase(phase);
    log("gameflow phase", phase);
    
    if (phase === "ReadyCheck") {
        handleReadyCheck();
        return;
    }
    
    if (phase === "ChampSelect") {
        declaredPickIntent = null;
        champions.clearPlayableCache();
        await champions.getPlayableChampions(true);
        await ui.refreshHomeDropdowns();
        return;
    }
    
    // Cleanup when leaving champ select
    ui.cleanupChampSelectUI();
    declaredPickIntent = null;
}

// ============ UTILITIES ============

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ LIFECYCLE ============

export function init(context) {
    const { socket } = context;
    
    // Gameflow phase changes
    socket.observe("/lol-gameflow/v1/gameflow-phase", (event) => {
        if (event.eventType !== "Delete") {
            handleGameflowPhase(event.data);
        }
    });
    
    // Champ select session updates
    socket.observe("/lol-champ-select/v1/session", (event) => {
        if (event.eventType === "Delete") {
            declaredPickIntent = null;
            latestChampSelectSession = null;
            return;
        }
        queueChampSelectSession(event.data);
    });
    
    // Ready check (backup trigger)
    socket.observe("/lol-matchmaking/v1/ready-check", (event) => {
        if (event.eventType === "Delete") return;
        if (event.data?.state === "InProgress" && event.data?.playerResponse === "None") {
            handleReadyCheck();
        }
    });
    
    // Refresh dropdowns when champions purchased
    socket.observe("/lol-inventory/v1/wallet", async (event) => {
        if (event.eventType !== "Update") return;
        log("Wallet updated, refreshing dropdowns...");
        await champions.getPlayableChampions(true);
        await ui.refreshHomeDropdowns();
    });

    window.addEventListener(config.CONFIG_CHANGE_EVENT, (event) => {
        const key = event.detail?.key;
        if (currentGameflowPhase !== "ChampSelect" || !latestChampSelectSession) {
            return;
        }

        if (!["auto-pick", "auto-ban", "pick-champions", "ban-champions", "force-pick", "force-ban"].includes(key)) {
            return;
        }

        log("Config changed during champ select, reprocessing session", key, event.detail?.value);
        queueChampSelectSession(latestChampSelectSession);
    });
    
    log(`v${VERSION} initialized`);
}

export async function load() {
    // Inject styles
    const styleUrl = new URL("./assets/style.css", import.meta.url).href;
    if (!document.querySelector(`link[href="${styleUrl}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = styleUrl;
        document.head.appendChild(link);
    }
    
    ui.initHomePanel();
    ui.initChampSelectUI();
    
    // Check current phase on load
    try {
        const response = await fetch("/lol-gameflow/v1/gameflow-phase");
        if (response.ok) {
            const phase = await response.json();
            await handleGameflowPhase(phase);
        }
    } catch (error) {
        log("Could not get current phase:", error);
    }
    
    log(`v${VERSION} loaded`);
}
