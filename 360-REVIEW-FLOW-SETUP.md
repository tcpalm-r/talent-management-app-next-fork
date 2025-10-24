# 360° Review Flow - Complete Setup Guide

## ✅ What's Been Implemented

The complete 360° feedback flow has been built with Resend.com email integration. Here's what was created:

### 1. **Email API Route** (`app/api/send-survey-invitation/route.ts`)
- Sends personalized survey invitation emails via Resend
- Includes secure access token links
- Tracks email delivery status in the database
- Beautiful HTML email template with branding

### 2. **Survey Wizard Updates** (`components/Survey360Wizard.tsx`)
- Automatically sends emails to all reviewers after survey creation
- Tracks email sending progress
- Handles email failures gracefully
- Reduced minimum reviewer requirement from 3 to 1 (for easier development)

### 3. **Public Reviewer Page** (`app/survey/complete/[token]/page.tsx`)
- Public-facing page where reviewers complete surveys
- Token-based authentication (no login required)
- Loads survey details and questions dynamically
- Collects ratings (1-5 scale) and optional comments
- Tracks reviewer status (pending → in_progress → completed)
- Beautiful, responsive UI with progress tracking

### 4. **Environment Variables** (`.env.local`)
- `RESEND_API_KEY` - Your Resend API key
- `RESEND_FROM_EMAIL` - The "from" email address (needs verification in Resend)
- `NEXT_PUBLIC_APP_URL` - Base URL for generating survey links

---

## 🚀 Testing the Flow

### **Step 1: Configure Resend Email Address**

Before testing, you need to verify your "from" email address in Resend:

1. Go to https://resend.com/domains
2. Either:
   - **Option A:** Add and verify your custom domain (recommended for production)
   - **Option B:** Use the default `onboarding@resend.dev` for testing
3. Update `.env.local`:
   ```bash
   RESEND_FROM_EMAIL=your-verified-email@yourdomain.com
   # OR for testing:
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```

### **Step 2: Clean Up Test Data (if needed)**

If you have leftover test surveys, clean them up in Supabase SQL Editor:

```sql
DELETE FROM feedback_360_survey_reviewers
WHERE survey_id IN (
  SELECT id FROM feedback_360_surveys WHERE status = 'draft'
);

DELETE FROM feedback_360_surveys WHERE status = 'draft';
```

### **Step 3: Create a Test Survey**

1. **Open your app:** http://localhost:3001
2. **Navigate to 360 Surveys section**
3. **Click "Create Survey"** or equivalent button
4. **Fill out the wizard:**
   - Select an employee
   - Choose questions (at least 1)
   - Add at least 1 reviewer (use YOUR email for testing!)
   - Set a due date
   - Complete the wizard

### **Step 4: Check Email Delivery**

1. **Check your inbox** (the email you used as a reviewer)
2. **Look for:** Subject line "360° Feedback Request for [Employee Name]"
3. **If no email arrives:**
   - Check Resend dashboard logs: https://resend.com/emails
   - Check browser console for errors
   - Check Supabase `feedback_360_survey_reviewers` table for `email_error` field

### **Step 5: Complete the Survey**

1. **Click the "Complete Survey" button** in the email
2. You should land on a page like: `http://localhost:3001/survey/complete/token-xxx`
3. **Fill out the survey:**
   - Rate each question (1-5 scale)
   - Optionally add comments
   - Click "Submit Feedback"
4. **Verify success:**
   - You should see a success message
   - Check `feedback_360_responses` table in Supabase for your responses
   - Check `feedback_360_survey_reviewers` table - status should be "completed"

---

## 🔍 Verification Checklist

Use these SQL queries in Supabase to verify everything worked:

### **1. Check Survey Was Created**
```sql
SELECT
  id,
  survey_name,
  status,
  created_at,
  due_date
FROM feedback_360_surveys
ORDER BY created_at DESC
LIMIT 5;
```

### **2. Check Reviewers Were Added**
```sql
SELECT
  r.reviewer_name,
  r.reviewer_email,
  r.relationship,
  r.status,
  r.email_sent_at,
  r.email_error,
  r.completed_at,
  s.survey_name
FROM feedback_360_survey_reviewers r
JOIN feedback_360_surveys s ON r.survey_id = s.id
ORDER BY r.created_at DESC
LIMIT 10;
```

### **3. Check Email Delivery Status**
```sql
SELECT
  reviewer_name,
  reviewer_email,
  status,
  CASE
    WHEN email_sent_at IS NOT NULL THEN 'Email Sent ✓'
    WHEN email_error IS NOT NULL THEN 'Email Failed ✗'
    ELSE 'Pending'
  END as email_status,
  email_sent_at,
  email_error
FROM feedback_360_survey_reviewers
ORDER BY created_at DESC
LIMIT 5;
```

### **4. Check Survey Responses**
```sql
SELECT
  res.id,
  s.survey_name,
  res.reviewer_email,
  q.question_text,
  res.rating,
  res.response_text,
  res.created_at
FROM feedback_360_responses res
JOIN feedback_360_surveys s ON res.survey_id = s.id
JOIN feedback_360_questions q ON res.question_id = q.id
ORDER BY res.created_at DESC
LIMIT 10;
```

---

## 🐛 Troubleshooting

### **Problem: Emails Not Sending**

**Check 1:** Resend API Key
```bash
# Verify in .env.local
cat .env.local | grep RESEND_API_KEY
```

**Check 2:** Resend Dashboard
- Go to https://resend.com/emails
- Look for failed sends and error messages

**Check 3:** Email Address Verification
- Make sure `RESEND_FROM_EMAIL` is verified in Resend
- For testing, use `onboarding@resend.dev`

**Check 4:** Check Database for Errors
```sql
SELECT email_error
FROM feedback_360_survey_reviewers
WHERE email_error IS NOT NULL;
```

### **Problem: Survey Link Doesn't Work**

**Check 1:** Verify Token Exists
```sql
SELECT access_token
FROM feedback_360_survey_reviewers
WHERE reviewer_email = 'your-test-email@example.com';
```

**Check 2:** Check Console Errors
- Open browser DevTools → Console
- Look for 404 or authentication errors

**Check 3:** Verify APP_URL
```bash
# Should match your dev server
echo $NEXT_PUBLIC_APP_URL  # Should be http://localhost:3001
```

### **Problem: Survey Won't Submit**

**Check 1:** All Questions Rated?
- Make sure you've rated ALL questions (not just commented)

**Check 2:** Check Console
- Look for API errors or validation failures

**Check 3:** Check Supabase RLS Policies
- Ensure the `feedback_360_responses` table allows inserts from anon users

---

## 📧 Email Template Preview

The email includes:
- **Personalized greeting** with reviewer name
- **Survey details:** Employee name, survey name, due date, relationship
- **Prominent "Complete Survey" button** with gradient styling
- **Privacy notice** about confidentiality
- **Professional branding** with purple/blue gradient theme

---

## 🔐 Security Notes

1. **Access Tokens:** Each reviewer gets a unique, unguessable token
2. **One-Time Use:** Once a survey is completed, the token can't be reused to modify responses
3. **No Authentication Required:** Reviewers don't need to log in
4. **Status Tracking:** System tracks pending → in_progress → completed

---

## 🎯 Next Steps

### **For Development:**
- Test with multiple reviewers
- Test reminder functionality (future feature)
- Test survey expiration/due dates
- Add batch survey creation testing

### **For Production:**
1. **Verify custom domain** in Resend
2. **Update `RESEND_FROM_EMAIL`** to your brand email
3. **Update `NEXT_PUBLIC_APP_URL`** to your production URL
4. **Set up RLS policies** for production security
5. **Add Supabase service role key** (for server-side operations)
6. **Test email deliverability** to different providers

### **Future Enhancements:**
- Email reminder functionality
- Survey expiration handling
- Batch email sending with progress tracking
- Email preview before sending
- Custom email templates per organization
- Analytics dashboard for survey completion rates

---

## 📁 Files Created/Modified

### **New Files:**
- `app/api/send-survey-invitation/route.ts` - Email sending API
- `app/survey/complete/[token]/page.tsx` - Public survey completion page
- `migration-add-relationship-column.sql` - Database migration

### **Modified Files:**
- `components/Survey360Wizard.tsx` - Added email sending logic
- `.env.local` - Added Resend configuration

---

## 🎉 You're All Set!

The 360° review flow is now fully functional with email notifications. Test it out and let me know if you encounter any issues!
