export function flattenActions(session) {
  return session.actions.flat();
}

export function getLocalPlayer(session) {
  return session.myTeam.find((player) => player.cellId === session.localPlayerCellId) ?? null;
}

export function getPendingPickAction(session) {
  return (
    flattenActions(session).find((action) => {
      return action.actorCellId === session.localPlayerCellId && action.type === "pick" && !action.completed;
    }) ?? null
  );
}

export function getActionsToProcess(session) {
  return flattenActions(session).filter((action) => {
    return action.actorCellId === session.localPlayerCellId && !action.completed && action.isInProgress;
  });
}

export function getSessionSnapshot(session) {
  return {
    bannedChampionIds: [...session.bans.myTeamBans, ...session.bans.theirTeamBans].filter(Boolean),
    pickedChampions: [...session.myTeam, ...session.theirTeam],
    teammateIntentChampionIds: session.myTeam.map((player) => player.championPickIntent).filter(Boolean),
  };
}

export function isChampionPicked(championId, pickedChampions) {
  return pickedChampions.some((player) => player.championId === championId);
}

export function selectChampionId(candidates, predicate) {
  for (const championId of candidates) {
    if (!championId || championId === 0) {
      continue;
    }

    if (predicate(championId)) {
      return championId;
    }
  }

  return null;
}
