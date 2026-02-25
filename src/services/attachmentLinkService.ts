import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export type RegisterAttachmentLinkParams = {
  slug: string;
  url: string;
  maintenanceId: string;
  attachmentName?: string;
  vehiclePlate?: string;
};

export type RegisterAttachmentLinkResponse = {
  shortUrl: string;
  slug: string;
};

const registerAttachmentLinkCallable = httpsCallable<RegisterAttachmentLinkParams, RegisterAttachmentLinkResponse>(
  functions,
  "registerAttachmentLink"
);

export const registerAttachmentLink = async (params: RegisterAttachmentLinkParams) => {
  const { data } = await registerAttachmentLinkCallable(params);
  return data;
};
