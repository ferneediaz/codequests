import { Injectable } from '@nestjs/common';
import { BattlesGateway } from '../../websockets/battles.gateway';
import {
    NewSubmissionForReviewPayload,
    SubmissionDecisionPayload,
    SubmissionEventsPort,
} from '../ports/submission-events.port';

@Injectable()
export class SubmissionEventsGatewayAdapter implements SubmissionEventsPort {
    constructor(private readonly gateway: BattlesGateway) {}

    emitNewSubmissionForReview(
        adminUserIds: string[],
        data: NewSubmissionForReviewPayload,
    ): void {
        for (const adminId of adminUserIds) {
            this.gateway.emitSubmissionEvent(
                adminId,
                'submission.new_for_review',
                data,
            );
        }
    }

    emitSubmissionApproved(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean {
        return this.gateway.emitSubmissionEvent(
            contributorId,
            'submission.approved',
            data,
        );
    }

    emitSubmissionRejected(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean {
        return this.gateway.emitSubmissionEvent(
            contributorId,
            'submission.rejected',
            data,
        );
    }

    emitSubmissionChangesRequested(
        contributorId: string,
        data: SubmissionDecisionPayload,
    ): boolean {
        return this.gateway.emitSubmissionEvent(
            contributorId,
            'submission.changes_requested',
            data,
        );
    }
}
