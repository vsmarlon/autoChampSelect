import { LcuSession, Lane } from "../../core/lcu/types";
import { getLocalPlayer, isChampionPicked, selectChampionId, SessionSnapshot } from "./selection";
import { CandidateSelection } from "../../utils/types";
import { ConfigStore } from "../../core/ConfigStore";
import { ChampionRepository } from "../../core/ChampionRepository";

export interface CandidateResolverDeps {
  configStore: ConfigStore;
  championRepository: ChampionRepository;
  describeChampion: (_championId: number | null | undefined) => string | null;
}

export function getChampionList(deps: CandidateResolverDeps, type: "pick" | "ban", session: LcuSession): number[] {
  const pos = getLocalPlayer(session)?.assignedPosition;
  const lane: Lane | undefined = pos ? (pos as Lane) : undefined;
  return deps.configStore.getEffectiveChampions(type, lane);
}

export function resolvePickIntentCandidate(
  deps: CandidateResolverDeps,
  session: LcuSession,
  snapshot: SessionSnapshot,
): CandidateSelection {
  const candidates = getChampionList(deps, "pick", session);
  const rejectedCandidates: string[] = [];
  const forcePick = deps.configStore.get("force-pick") || false;

  const championId = selectChampionId(candidates, (candidateId) => {
    const championLabel = deps.describeChampion(candidateId);

    if (snapshot.bannedChampionIds.includes(candidateId)) {
      rejectedCandidates.push(`${championLabel}: banned`);
      return false;
    }

    if (!forcePick && isChampionPicked(candidateId, snapshot.pickedChampionIds)) {
      rejectedCandidates.push(`${championLabel}: already-picked`);
      return false;
    }

    return true;
  });

  return { championId, candidates, rejectedCandidates };
}

export function resolveActionCandidate(
  deps: CandidateResolverDeps,
  type: "pick" | "ban",
  session: LcuSession,
  snapshot: SessionSnapshot,
): CandidateSelection {
  const candidates = getChampionList(deps, type, session);
  const rejectedCandidates: string[] = [];
  const force = !!deps.configStore.get(`force-${type}`);

  const championId = selectChampionId(candidates, (candidateId) => {
    const championLabel = deps.describeChampion(candidateId);

    if (snapshot.bannedChampionIds.includes(candidateId)) {
      rejectedCandidates.push(`${championLabel}: banned`);
      return false;
    }

    if (type === "pick") {
      if (!force && isChampionPicked(candidateId, snapshot.pickedChampionIds)) {
        rejectedCandidates.push(`${championLabel}: already-picked`);
        return false;
      }
      return true;
    }

    if (isChampionPicked(candidateId, snapshot.pickedChampionIds)) {
      rejectedCandidates.push(`${championLabel}: already-picked`);
      return false;
    }

    if (!force && snapshot.teammateIntentChampionIds.includes(candidateId)) {
      rejectedCandidates.push(`${championLabel}: teammate-intent`);
      return false;
    }

    return true;
  });

  return { championId, candidates, rejectedCandidates };
}

export function isDeclaredPickIntentStillValid(
  declaredPickIntent: number | null,
  snapshot: SessionSnapshot,
  forcePick: boolean,
): boolean {
  if (!declaredPickIntent) {
    return false;
  }

  if (snapshot.bannedChampionIds.includes(declaredPickIntent)) {
    return false;
  }

  if (!forcePick && isChampionPicked(declaredPickIntent, snapshot.pickedChampionIds)) {
    return false;
  }

  return true;
}
