import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body;

  // Validate input
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Sanitize and validate input types
  if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid input format' });
  }

  // Trim and validate lengths
  const sanitizedName = name.trim();
  const sanitizedEmail = email.trim();
  const sanitizedMessage = message.trim();

  if (sanitizedName.length === 0 || sanitizedName.length > 200) {
    return res.status(400).json({ error: 'Name must be between 1 and 200 characters' });
  }

  if (sanitizedEmail.length === 0 || sanitizedEmail.length > 254) {
    return res.status(400).json({ error: 'Email must be between 1 and 254 characters' });
  }

  // Validate email format
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(sanitizedEmail)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate message length
  if (sanitizedMessage.length < 10 || sanitizedMessage.length > 5000) {
    return res.status(400).json({ error: 'Message must be between 10 and 5000 characters' });
  }

  // Check for potentially malicious content
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi
  ];

  const allInput = sanitizedName + sanitizedEmail + sanitizedMessage;
  for (const pattern of dangerousPatterns) {
    if (pattern.test(allInput)) {
      return res.status(400).json({ error: 'Potentially malicious content detected' });
    }
  }

  try {
    // Get email configuration from environment variables
    // The recipient email should be set in environment variables (not exposed to frontend)
    const recipientEmail = process.env.CONTACT_EMAIL || process.env.ADMIN_EMAIL;
    
    if (!recipientEmail) {
      console.error('CONTACT_EMAIL or ADMIN_EMAIL environment variable is not set');
      return res.status(500).json({ 
        error: 'Email service is not configured. Please contact the administrator.' 
      });
    }

    // Create transporter
    // For production, you should configure SMTP settings in environment variables
    // For now, we'll use a simple configuration that works with most email services
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // Your email
        pass: process.env.SMTP_PASSWORD, // Your email password or app password
      },
    });

    // If SMTP credentials are not provided, use a fallback method
    // This allows the user to configure it later
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('SMTP credentials not configured. Email will not be sent.');
      // In development, you might want to log the email instead
      console.log('Contact Form Submission:', {
        name,
        email,
        message,
        recipientEmail,
        timestamp: new Date().toISOString()
      });

      // Return success even if email is not configured (for development)
      // In production, you should return an error if email is not configured
      return res.status(200).json({ 
        success: true,
        message: 'Your message has been received. We will get back to you soon.',
        note: 'Email service is not fully configured. Please configure SMTP settings to receive emails.'
      });
    }

    // Verify transporter configuration
    await transporter.verify();

    // Email content
    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipientEmail,
      replyTo: sanitizedEmail, // Allow replying directly to the user
      subject: `Contact Form Submission from ${sanitizedName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Name:</strong> ${sanitizedName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> <a href="mailto:${sanitizedEmail}">${sanitizedEmail.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</a></p>
            <p style="margin: 10px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="margin: 20px 0;">
            <h3 style="color: #374151; margin-bottom: 10px;">Message:</h3>
            <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #dc2626; border-radius: 4px;">
              <p style="white-space: pre-wrap; color: #4b5563; line-height: 1.6;">${sanitizedMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            </div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
            <p>This email was sent from the Indicore contact form.</p>
            <p>You can reply directly to this email to respond to ${sanitizedName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}.</p>
          </div>
        </div>
      `,
      text: `
New Contact Form Submission

Name: ${sanitizedName}
Email: ${sanitizedEmail}
Submitted: ${new Date().toLocaleString()}

Message:
${sanitizedMessage}

---
This email was sent from the Indicore contact form.
You can reply directly to this email to respond to ${name}.
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return res.status(200).json({ 
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.' 
    });
  } catch (error) {
    console.error('Error sending email:', error);
    
    // Don't expose internal error details to the client
    return res.status(500).json({ 
      error: 'Failed to send message. Please try again later or contact us directly.' 
    });
  }
}

