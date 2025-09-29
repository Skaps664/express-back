const nodemailer = require('nodemailer')

// Create transporter using env vars - supports SMTP or SendGrid (via SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.SMTP_HOSTNAME,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
})

const CONTACT_TO = process.env.CONTACT_TO_EMAIL || process.env.PARTNERSHIP_EMAIL || 'info@solarexpress.pk'

exports.submitPartnership = async (req, res) => {
  try {
    const { name, company, email, phone, partnershipType, message } = req.body || {}

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email and message are required' })
    }

    const subject = `New Partnership Application from ${company || name}`
    const text = `Name: ${name}\nCompany: ${company || ''}\nEmail: ${email}\nPhone: ${phone || ''}\nType: ${partnershipType || ''}\n\nMessage:\n${message}`

    const html = `
      <h3>New Partnership Application</h3>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Company:</strong> ${company || '—'}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || '—'}</p>
      <p><strong>Type:</strong> ${partnershipType || '—'}</p>
      <hr/>
      <p>${message.replace(/\n/g, '<br/>')}</p>
    `

    // Try to send email (if transporter configured)
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || `no-reply@${req.headers.host || 'solarexpress.pk'}`,
        to: CONTACT_TO,
        subject,
        text,
        html,
      })
    } catch (err) {
      console.warn('Partnership email send failed (continuing):', err && err.message)
      // Still respond 200 if we want to accept submissions even when email fails; return 500 instead
      return res.status(500).json({ success: false, message: 'Failed to send email', error: err && err.message })
    }

    return res.status(200).json({ success: true, message: 'Application submitted' })
  } catch (error) {
    console.error('submitPartnership error:', error)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
}
