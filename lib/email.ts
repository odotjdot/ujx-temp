import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-west-1',
});

export async function sendNotificationEmail(to: string, subject: string, text: string, html?: string) {
  const params = {
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Body: {
        Text: { Data: text },
        ...(html && { Html: { Data: html } }),
      },
      Subject: { Data: subject },
    },
    Source: process.env.EMAIL_FROM || 'info@ujamaaexpo.com',
  };

  try {
    await ses.send(new SendEmailCommand(params));
    return true;
  } catch (error) {
    console.error('SES Error:', error);
    return false;
  }
}