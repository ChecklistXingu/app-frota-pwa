import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type SendDirectorApprovalParams = {
  maintenanceId: string;
  targetPhone: string;
  previewText: string;
  quote: {
    vendor?: string;
    workshopLocation?: string;
    laborCost?: number;
    items: { name: string; cost: number }[];
    total?: number;
    notes?: string;
  };
  metadata: {
    driverName: string;
    branch: string;
    vehicleLabel: string;
    requestTitle: string;
    observation?: string;
    managerNote?: string;
    photoCount?: number;
    audioUrl?: string | null;
    audioDurationSeconds?: number | null;
  };
};

export type SendDirectorApprovalResponse = {
  messageId: string;
  deliveryMethod: "zapi";
  delivered?: boolean;
};

const sendApprovalCallable = httpsCallable<SendDirectorApprovalParams, SendDirectorApprovalResponse>(functions, "sendDirectorApproval");

export const sendDirectorApprovalRequest = async (params: SendDirectorApprovalParams) => {
  const { data } = await sendApprovalCallable(params);
  return data;
};

export type SendApprovalEmailParams = {
  maintenanceId: string;
  previewText: string;
  subject: string;
  to: string;
  cc?: string[];
  quote: SendDirectorApprovalParams["quote"];
  metadata: SendDirectorApprovalParams["metadata"] & {
    approvalId?: string;
  };
  attachments?: {
    name: string;
    url: string;
    contentType?: string;
  }[];
};

export type SendApprovalEmailResponse = {
  deliveryMethod: "email";
  sentAt: string;
};

const sendEmailCallable = httpsCallable<SendApprovalEmailParams, SendApprovalEmailResponse>(functions, "sendApprovalEmail");

export const sendDirectorApprovalEmail = async (params: SendApprovalEmailParams) => {
  const { data } = await sendEmailCallable(params);
  return data;
};
