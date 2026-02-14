export function generateOtpEmailTemplate(otp: any) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Verification</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Arial', sans-serif;
      background: linear-gradient(135deg, #667eea, #764ba2);
      background-repeat: no-repeat;
      background-size: cover;
      min-height: 100vh;
    }
    .container {
      max-width: 500px;
      margin: 50px auto;
      background-color: #ffffff;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      overflow: hidden;
    }
    .header {
      background-color: #764ba2;
      color: #ffffff;
      text-align: center;
      padding: 25px 20px;
      font-size: 22px;
      font-weight: bold;
    }
    .body {
      padding: 30px 20px;
      text-align: center;
      color: #333333;
    }
    .body p {
      font-size: 16px;
      line-height: 1.5;
      margin: 15px 0;
    }
    .otp-box {
      display: inline-block;
      padding: 15px 25px;
      margin: 20px 0;
      font-size: 28px;
      font-weight: bold;
      color: #ffffff;
      background: linear-gradient(90deg, #667eea, #764ba2);
      border-radius: 8px;
      letter-spacing: 4px;
    }
    .footer {
      background-color: #f4f6f8;
      text-align: center;
      padding: 20px;
      font-size: 14px;
      color: #777777;
    }

    @media only screen and (max-width: 600px) {
      .container {
        margin: 20px;
      }
      .header {
        font-size: 20px;
        padding: 20px 15px;
      }
      .body {
        padding: 20px 15px;
      }
      .otp-box {
        padding: 12px 20px;
        font-size: 24px;
      }
    }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">OTP Verification</div>
      <div class="body">
        <p>Hello,</p>
        <p>Your One-Time Password (OTP) for verification is:</p>
        <div class="otp-box">${otp}</div>
        <p>This OTP is valid for the next 10 minutes. Please do not share it with anyone.</p>
      </div>
      <div class="footer">
        &copy; 2025 All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
}
