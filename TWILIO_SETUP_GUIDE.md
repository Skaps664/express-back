# 🔧 Twilio WhatsApp Setup - Complete Guide

## Current Issue: Error Code 63015

Your Twilio trial account can only send WhatsApp messages to **verified phone numbers**.

## ✅ How to Fix Twilio WhatsApp Notifications

### Step 1: Verify Your Admin Number in Twilio Console

1. **Open Twilio Console**: https://console.twilio.com/
2. **Login** with your Twilio account credentials
3. **Navigate to**: `Develop` → `Messaging` → `Try it out` → `Send a WhatsApp message`
4. **OR go directly to**: https://console.twilio.com/develop/sms/try-it-out/whatsapp-learn

### Step 2: Add Your WhatsApp Number

1. In the "Send a WhatsApp message" section
2. **Add your phone number**: `+923259327819`
3. **Send yourself a test message** to verify the number
4. **Follow the verification process**

### Step 3: Join Twilio WhatsApp Sandbox

1. **Add the Twilio WhatsApp number** to your contacts: `+1 415 523 8886`
2. **Send the join code** to that number (you'll see this in the console)
3. **Wait for confirmation** that you've joined the sandbox

### Step 4: Test the Setup

After verification, run this command to test:

```bash
cd /home/skaps/solar-express-live/backend
node check-twilio-status.js
```

## 🔄 Alternative: Upgrade to Paid Twilio Account

If you want to skip verification entirely:

1. **Upgrade your account** in Twilio Console
2. **Add billing information**
3. **Remove trial restrictions**
4. **Send to any number without verification**

## 🧪 Current Configuration Status

Your Twilio configuration:

- ✅ Account SID: `ACcf250aa9102409de0d8c898b0f1c53b6`
- ✅ Auth Token: Configured
- ✅ WhatsApp Number: `+14155238886`
- ⚠️ Admin Number: `+923259327819` (needs verification)

## 📱 Step-by-Step WhatsApp Verification

### What you need to do RIGHT NOW:

1. **Open**: https://console.twilio.com/develop/sms/try-it-out/whatsapp-learn
2. **Look for**: "Send a WhatsApp message" section
3. **Enter your number**: +923259327819
4. **Click "Send"** to send yourself a test message
5. **Follow the verification steps** shown in the console

### You should see something like this in the console:

```
To use WhatsApp with Twilio, join our sandbox by sending
"join <CODE>" to +1 415 523 8886
```

### What to do:

1. **Add to WhatsApp contacts**: +1 415 523 8886
2. **Send message**: "join [whatever-code-they-show]"
3. **Wait for confirmation**

## ✅ After Verification Complete

Once your number is verified, all future order notifications will work automatically!

## 🔍 Checking Your Status

Use these scripts to monitor your setup:

```bash
# Check Twilio account and recent messages
node check-twilio-status.js

# Test notifications
node test-notifications.js

# Check recent order notification status
node check-recent-orders.js
```

## 🚨 Common Issues & Solutions

### Issue: "Sender or recipient not opted in"

**Solution**: Complete the WhatsApp sandbox verification above

### Issue: "Invalid phone number"

**Solution**: Make sure your number includes country code (+923259327819)

### Issue: "Authentication failed"

**Solution**: Check your Account SID and Auth Token in .env file

### Issue: "Account suspended"

**Solution**: Check your Twilio account status and billing

## 📞 Need Help?

If you're still having issues:

1. Screenshot your Twilio console WhatsApp section
2. Run `node check-twilio-status.js` and share the output
3. Check that your .env file has the correct credentials
