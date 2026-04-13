import { LcuAction, LcuPlayer, LcuSession } from "../../core/lcu/types";

export function flattenActions(session: LcuSession): LcuAction[] {
  return session.actions.flat();
}

function compareActionOrder(left: LcuAction, right: LcuAction): number {
  const leftPickTurn = left.pickTurn ?? Number.MAX_SAFE_INTEGER;
  const rightPickTurn = right.pickTurn ?? Number.MAX_SAFE_INTEGER;
  if (leftPickTurn !== rightPickTurn) {
    return leftPickTurn - rightPickTurn;
  }

  return left.id - right.id;
}

function getLocalActions(session: LcuSession): LcuAction[] {
  return flattenActions(session)
    .filter((action) => action.actorCellId === session.localPlayerCellId)
    .sort(compareActionOrder);
}

export function getLocalPlayer(session: LcuSession): LcuPlayer | null {
  return session.myTeam.find((player) => player.cellId === session.localPlayerCellId) ?? null;
}

export function getPendingPickAction(session: LcuSession): LcuAction | null {
  return (
    getLocalActions(session).find((action) => {
      return action.type === "pick" && !action.completed;
    }) ?? null
  );
}

export function getActionsToProcess(session: LcuSession): LcuAction[] {
  return getLocalActions(session).filter((action) => {
    return (
      !action.completed &&
      action.isInProgress &&
      (action.type === "pick" || action.type === "ban")
    );
  });
}

export interface SessionSnapshot {
  bannedChampionIds: number[];
  pickedChampionIds: number[];
  teammateIntentChampionIds: number[];
}

function getActionChampionIds(
  session: LcuSession,
  type: "pick" | "ban",
  predicate: (_action: LcuAction) => boolean,
): number[] {
  return flattenActions(session)
    .filter((action) => action.type === type && action.championId > 0 && predicate(action))
    .map((action) => action.championId);
}

export function getSessionSnapshot(session: LcuSession): SessionSnapshot {
  return {
    bannedChampionIds: [
      ...new Set([
        ...session.bans.myTeamBans,
        ...session.bans.theirTeamBans,
        ...getActionChampionIds(session, "ban", (_action) => _action.completed || _action.isInProgress),
      ]),
    ].filter((id): id is number => id > 0),
    pickedChampionIds: [
      ...new Set([
        ...session.myTeam.map((player) => player.championId),
        ...session.theirTeam.map((player) => player.championId),
        ...getActionChampionIds(session, "pick", (_action) => _action.completed),
      ]),
    ].filter((id): id is number => id > 0),
    teammateIntentChampionIds: session.myTeam
      .map((player) => player.championPickIntent)
      .filter((id): id is number => id > 0),
  };
}

export function isChampionPicked(championId: number, pickedChampionIds: number[]): boolean {
  return pickedChampionIds.includes(championId);
}

export function selectChampionId(candidates: number[], predicate: (_id: number) => boolean): number | null {
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
