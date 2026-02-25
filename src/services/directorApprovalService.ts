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

const callable = httpsCallable<SendDirectorApprovalParams, SendDirectorApprovalResponse>(
  functions,
  "sendDirectorApproval"
);

export const sendDirectorApprovalRequest = async (params: SendDirectorApprovalParams) => {
  const { data } = await callable(params);
  return data;
};
