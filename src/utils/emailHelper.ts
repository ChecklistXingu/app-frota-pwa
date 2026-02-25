export type EmailPayload = {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
};

const buildMailtoUrl = ({ to, cc, subject, body }: EmailPayload) => {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);
  const ccParam = cc?.length ? `&cc=${encodeURIComponent(cc.join(';'))}` : '';
  return `mailto:${encodeURIComponent(to)}?subject=${encodedSubject}${ccParam}&body=${encodedBody}`;
};

export const openEmailClient = (payload: EmailPayload) => {
  const url = buildMailtoUrl(payload);
  window.open(url, '_blank');
};
