import { MATCH_STATUS, type MatchStatusValue } from '../validation/matches.js';

/** Timestamps arrive as Date from Drizzle, or as ISO strings from a request body. */
type DateInput = Date | string;

export interface SyncableMatch {
    startTime: DateInput;
    endTime: DateInput | null;
    status: MatchStatusValue;
}

export function getMatchStatus(
    startTime: DateInput,
    endTime: DateInput | null,
    now: Date = new Date(),
): MatchStatusValue | null {
    const start = new Date(startTime);

    if (Number.isNaN(start.getTime())) {
        return null;
    }

    if (now < start) {
        return MATCH_STATUS.SCHEDULED;
    }

    // No end time recorded yet: the match has started but cannot be finished.
    if (endTime === null) {
        return MATCH_STATUS.LIVE;
    }

    const end = new Date(endTime);

    if (Number.isNaN(end.getTime())) {
        return null;
    }

    if (now >= end) {
        return MATCH_STATUS.FINISHED;
    }

    return MATCH_STATUS.LIVE;
}

export async function syncMatchStatus<T extends SyncableMatch>(
    match: T,
    updateStatus: (status: MatchStatusValue) => void | Promise<void>,
): Promise<MatchStatusValue> {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) {
        return match.status;
    }
    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}
