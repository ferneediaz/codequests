export interface NewSubmissionForReviewPayload {
    submissionId: string;
    title: string;
    submitterUsername: string;
    submitterAvatarUrl?: string | null;
    createdAt: Date | string;
}

export interface SubmissionDecisionPayload {
    submissionId: string;
    title: string;
    reviewerUsername: string;
    reviewNotes?: string | null;
    /** When status === APPROVED, the new published Problem id so the client
     *  can deep-link to /practice/:id. */
    linkedProblemId?: string | null;
    decidedAt: Date | string;
}

export interface SubmissionEventsPort {
    /** Fan-out to every admin: a contributor just submitted a new problem. */
    emitNewSubmissionForReview(
        adminUserIds: string[],
        data: NewSubmissionForReviewPayload,
    ): void;
    emitSubmissionApproved(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean;
    emitSubmissionRejected(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean;
    emitSubmissionChangesRequested(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean;
}

export const SUBMISSION_EVENTS_PORT = 'SUBMISSION_EVENTS_PORT';
