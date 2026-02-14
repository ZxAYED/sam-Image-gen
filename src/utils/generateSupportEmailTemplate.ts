type GetSupportDto = {
  subject?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  date?: string | Date | null;
  time?: string | null;
  streetAndHouseNumber?: string | null;
  city?: string | null;
  zipCode?: string | null;
  country?: string | null;
  message?: string | null;
};

export function generateSupportEmailTemplate(
  payload: GetSupportDto,
  serviceName: string,
  fileLink?: string,
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Support Request</title>
<style>
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, sans-serif;
    background: linear-gradient(135deg, #667eea, #764ba2);
    min-height: 100vh;
  }
  .container {
    max-width: 700px;
    margin: 40px auto;
    background: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  }
  .header {
    background: #764ba2;
    color: #ffffff;
    padding: 24px;
    font-size: 22px;
    font-weight: bold;
    text-align: center;
  }
  .body {
    padding: 30px;
    color: #333333;
  }
  .row {
    margin-bottom: 14px;
    font-size: 15px;
  }
  .label {
    font-weight: bold;
    color: #555555;
  }
  .message-box {
    margin-top: 20px;
    padding: 18px;
    background: #f4f6f8;
    border-radius: 8px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  .footer {
    background: #f4f6f8;
    text-align: center;
    padding: 18px;
    font-size: 13px;
    color: #777777;
  }
</style>
</head>

<body>
  <div class="container">
    <div class="header">New Support Request</div>

    <div class="body">
      <div class="row">
        <span class="label">Subject:</span> ${payload.subject ?? 'Support Inquiry'}
      </div>

      <div class="row">
        <span class="label">Service:</span> ${serviceName}
      </div>

      <div class="row">
        <span class="label">Name:</span> ${payload.firstName} ${payload.lastName}
      </div>

      <div class="row">
        <span class="label">Company:</span> ${payload.companyName}
      </div>

      <div class="row">
        <span class="label">Email:</span> ${payload.email}
      </div>

      ${
        payload.date || payload.time
          ? `<div class="row">
              <span class="label"> Date & Time:</span>
              ${payload.date ? new Date(payload.date).toDateString() : ''} ${
                payload.time ?? ''
              }
            </div>`
          : ''
      }

      ${
        payload.streetAndHouseNumber ||
        payload.city ||
        payload.zipCode ||
        payload.country
          ? `<div class="row">
              <span class="label">Address:</span>
              ${payload.streetAndHouseNumber ?? ''} ${
                payload.city ? ', ' + payload.city : ''
              } ${payload.zipCode ?? ''} ${
                payload.country ? ', ' + payload.country : ''
              }
            </div>`
          : ''
      }

     

      ${
        fileLink
          ? `<div class="row">
              <span class="label">Attachment:</span>
              <a href="${fileLink}" target="_blank">View uploaded file</a>
            </div>`
          : ''
      }

      <div class="message-box">
        ${payload.message ?? ''}
      </div>
    </div>

    <div class="footer">
      &copy; 2025 Support System. All rights reserved.
    </div>
  </div>
</body>
</html>
`;
}
