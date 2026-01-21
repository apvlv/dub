/**
 * Partner Approved Workflow Handler
 *
 * Executes the partner-approved workflow steps locally.
 * This replicates the logic from /api/workflows/partner-approved route.
 */

import { triggerDraftBountySubmissionCreation } from "@/lib/api/bounties/trigger-draft-bounty-submissions";
import { createPartnerDefaultLinks } from "@/lib/api/partners/create-partner-default-links";
import { getPartnerInviteRewardsAndBounties } from "@/lib/api/partners/get-partner-invite-rewards-and-bounties";
import { getProgramEnrollmentOrThrow } from "@/lib/api/programs/get-program-enrollment-or-throw";
import { executeWorkflows } from "@/lib/api/workflows/execute-workflows";
import { polyfillSocialMediaFields } from "@/lib/social-utils";
import { PlanProps } from "@/lib/types";
import { sendWorkspaceWebhook } from "@/lib/webhook/publish";
import { EnrolledPartnerSchema } from "@/lib/zod/schemas/partners";
import { sendBatchEmail } from "@dub/email";
import PartnerApplicationApproved from "@dub/email/templates/partner-application-approved";
import { prisma } from "@dub/prisma";
import { log } from "@dub/utils";

interface PartnerApprovedPayload {
  programId: string;
  partnerId: string;
  userId: string;
}

interface WorkflowContext {
  runId: string;
}

/**
 * Create a logger for workflow steps
 */
function createLogger(runId: string) {
  return {
    info: (params: { message: string; data?: unknown }) => {
      console.log(`[Workflow:partner-approved:${runId}] ${params.message}`, params.data || "");
    },
    error: (params: { message: string; data?: unknown }) => {
      console.error(`[Workflow:partner-approved:${runId}] ERROR: ${params.message}`, params.data || "");
    },
  };
}

/**
 * Execute the partner-approved workflow
 */
export async function executePartnerApprovedWorkflow(
  payload: Record<string, unknown>,
  ctx: WorkflowContext,
): Promise<void> {
  const { programId, partnerId, userId } = payload as PartnerApprovedPayload;
  const logger = createLogger(ctx.runId);

  logger.info({
    message: "Starting partner-approved workflow",
    data: { programId, partnerId, userId },
  });

  // Get program enrollment data
  const { program, partner, links, ...programEnrollment } =
    await getProgramEnrollmentOrThrow({
      programId,
      partnerId,
      include: {
        program: true,
        partner: true,
        links: true,
      },
    });

  const { groupId } = programEnrollment;

  // Step 1: Create partner default links
  logger.info({
    message: "Started executing workflow step 'create-default-links'.",
    data: { programId, partnerId },
  });

  if (!groupId) {
    logger.error({
      message: `The partner ${partnerId} is not associated with any group.`,
    });
  } else {
    try {
      let { partnerGroupDefaultLinks, utmTemplate } =
        await prisma.partnerGroup.findUniqueOrThrow({
          where: { id: groupId },
          include: {
            partnerGroupDefaultLinks: true,
            utmTemplate: true,
          },
        });

      if (partnerGroupDefaultLinks.length === 0) {
        logger.error({
          message: `Group ${groupId} does not have any default links.`,
        });
      } else {
        // Skip existing default links
        for (const link of links) {
          if (link.partnerGroupDefaultLinkId) {
            partnerGroupDefaultLinks = partnerGroupDefaultLinks.filter(
              (defaultLink) => defaultLink.id !== link.partnerGroupDefaultLinkId,
            );
          }
        }

        // Find the workspace
        const workspace = await prisma.project.findUniqueOrThrow({
          where: { id: program.workspaceId },
          select: { id: true, plan: true },
        });

        const partnerLinks = await createPartnerDefaultLinks({
          workspace: {
            id: workspace.id,
            plan: workspace.plan as PlanProps,
          },
          program: {
            id: program.id,
            defaultFolderId: program.defaultFolderId,
          },
          partner: {
            id: partner.id,
            name: partner.name,
            email: partner.email!,
            tenantId: programEnrollment.tenantId ?? undefined,
          },
          group: {
            defaultLinks: partnerGroupDefaultLinks,
            utmTemplate: utmTemplate,
          },
          userId,
        });

        logger.info({
          message: `Created ${partnerLinks.length} partner default links.`,
          data: partnerLinks.map(({ id, url, shortLink }) => ({
            id,
            url,
            shortLink,
          })),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        message: `Failed to create default links: ${message}`,
      });
    }
  }

  // Step 2: Send email to partner
  logger.info({
    message: "Started executing workflow step 'send-email'.",
    data: { programId, partnerId },
  });

  if (!groupId) {
    logger.error({
      message: `The partner ${partnerId} is not associated with any group.`,
    });
  } else {
    try {
      // Find the partner users to send email notification
      const partnerUsers = await prisma.partnerUser.findMany({
        where: {
          partnerId,
          notificationPreferences: {
            applicationApproved: true,
          },
          user: {
            email: { not: null },
          },
        },
        select: {
          user: {
            select: { id: true, email: true },
          },
        },
      });

      if (partnerUsers.length === 0) {
        logger.info({
          message: `No partner users found for partner ${partnerId} to send email notification.`,
        });
      } else {
        logger.info({
          message: `Sending email notification to ${partnerUsers.length} partner users.`,
          data: partnerUsers,
        });

        const rewardsAndBounties = await getPartnerInviteRewardsAndBounties({
          programId,
          groupId: programEnrollment.groupId || program.defaultGroupId,
        });

        const { data, error } = await sendBatchEmail(
          partnerUsers.map(({ user }) => ({
            variant: "notifications",
            to: user.email!,
            subject: `Your application to join ${program.name} partner program has been approved!`,
            replyTo: program.supportEmail || "noreply",
            react: PartnerApplicationApproved({
              program: {
                name: program.name,
                logo: program.logo,
                slug: program.slug,
              },
              partner: {
                name: partner.name,
                email: user.email!,
                payoutsEnabled: Boolean(partner.payoutsEnabledAt),
              },
              ...rewardsAndBounties,
            }),
          })),
          {
            idempotencyKey: `application-approved/${programEnrollment.id}`,
          },
        );

        if (data) {
          logger.info({
            message: `Sent emails to ${partnerUsers.length} partner users.`,
            data: data,
          });
        }

        if (error) {
          throw new Error(error.message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        message: `Failed to send email: ${message}`,
      });
    }
  }

  // Step 3: Send webhook to workspace
  logger.info({
    message: "Started executing workflow step 'send-webhook'.",
    data: { programId, partnerId },
  });

  try {
    const partnerPlatforms = await prisma.partnerPlatform.findMany({
      where: { partnerId },
    });

    const enrolledPartner = EnrolledPartnerSchema.parse({
      ...programEnrollment,
      ...partner,
      ...polyfillSocialMediaFields(partnerPlatforms),
      id: partner.id,
      status: programEnrollment.status,
      links,
    });

    const workspace = await prisma.project.findUniqueOrThrow({
      where: { id: program.workspaceId },
      select: { id: true, webhookEnabled: true },
    });

    await sendWorkspaceWebhook({
      workspace,
      trigger: "partner.enrolled",
      data: enrolledPartner,
    });

    logger.info({
      message: `Sent "partner.enrolled" webhook to workspace ${workspace.id}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      message: `Failed to send webhook: ${message}`,
    });
  }

  // Step 4: Trigger draft bounty submission creation
  logger.info({
    message: "Started executing workflow step 'trigger-draft-bounty-submission-creation'.",
    data: { programId, partnerId },
  });

  try {
    await triggerDraftBountySubmissionCreation({
      programId,
      partnerIds: [partnerId],
    });

    logger.info({
      message: `Triggered draft bounty submission creation for partner ${partnerId} in program ${programId}.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      message: `Failed to trigger draft bounty submission: ${message}`,
    });
  }

  // Step 5: Execute Dub workflows using the "partnerEnrolled" trigger
  logger.info({
    message: "Started executing workflow step 'execute-workflows' for the trigger 'partnerEnrolled'.",
    data: { programId, partnerId },
  });

  try {
    await executeWorkflows({
      trigger: "partnerEnrolled",
      context: {
        programId,
        partnerId,
      },
    });

    logger.info({
      message: "Completed executing Dub workflows.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({
      message: `Failed to execute Dub workflows: ${message}`,
    });
  }

  logger.info({
    message: "Completed partner-approved workflow",
    data: { programId, partnerId },
  });
}
