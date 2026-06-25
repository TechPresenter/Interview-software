# Database schema

MongoDB via Mongoose. 15 collections. All use `timestamps: true` (`createdAt`,
`updatedAt`). Relationships are `ObjectId` refs.

## Entity relationships

```
Company 1───* User            (company staff)
Company 1───* Job
Company 1───* Candidate
Company 1───1 Subscription ───* Payment
Job     1───* Candidate
Job     1───* Interview
Candidate 1─* Interview
Interview 1─* Answer
Interview 1─1 Report
Question  *──* Interview        (asked questions tracked on Interview.engineState)
User    1───* Notification
* AuditLog / ActivityLog / AiUsage / SystemSetting are cross-cutting logs/config
```

## Collections (key fields)

### User
`name, email*, password(select:false), role[super_admin|company_admin|recruiter|hr_manager|candidate],
company→Company, isActive, isEmailVerified, twoFactor{enabled,secret}, providers{google,linkedin},
tokenVersion, lastLoginAt`
- Indexes: `email` (unique), `{company, role}`
- Methods: `comparePassword()`, password auto-hash hook, `toJSON()` strips secrets.

### Company
`name, slug*, owner→User, status[active|suspended|pending], plan, subscription→Subscription,
limits{seats, activeJobs, interviewsPerMonth, aiTokensPerMonth}, branding{...}`

### Job
`company→Company, title, slug, skills[{name,weight,required}], experience{min,max}, salary{...},
interviewConfig{types,durationMinutes,questionCount,adaptiveDifficulty}, status[draft|open|paused|closed]`
- Text index on `title, description`.

### Candidate
`company→Company, user→User?, job→Job, name, email, education[], experience[], skills[],
resume{url,text,...}, resumeAnalysis{atsScore,jobMatch,...}, stage[pipeline], source, notes[]`
- Compound unique: `{company, email, job}` (sparse).

### Interview
`company, job, candidate, accessToken*(public link), types[], status, config{...},
engineState{currentIndex,difficulty,phase,askedQuestionIds}, transcript[{role,text,at}],
recordings{videoUrl,audioUrl}, proctoring{integrityScore,events[]}, report→Report`
- Method `recomputeIntegrity()`.

### Question
`company→Company|null(global), category, difficulty, text, skills[], coding{...}, expectedPoints[],
competencies[], isActive, usageCount`

### Answer
`interview→Interview, question→Question, questionText, response, audioUrl, durationSeconds,
evaluation{score,competencyScores(Map),reasoning,keywordsHit[],keywordsMissed[]}`

### Report
`company, interview*(unique), candidate, job, scores{technical,communication,confidence,behavioral,
leadership,problemSolving,culturalFit}, overallScore, strengths[], weaknesses[], improvementAreas[],
detailedFeedback, recommendation[strong_hire|hire|consider|reject], weightage, integrityScore`

### Subscription
`company, plan, status[trialing|active|past_due|canceled|incomplete], billingCycle, provider,
providerCustomerId, providerSubscriptionId, amount, currency, currentPeriodStart/End, coupon{...}`

### Payment
`company, subscription, provider[stripe|razorpay], providerPaymentId, amount, currency,
status[created|pending|paid|failed|refunded], invoiceNumber*, invoiceUrl, paidAt, raw`

### Notification
`recipient→User, company, type, title, body, link, channels[in_app|email|sms|whatsapp], isRead`

### ActivityLog
`company, actor→User, action, entityType, entityId, summary, meta` — TTL 90 days.

### AuditLog
`actor→User, actorRole, company, action, status[success|failure], entityType, entityId, ip,
userAgent, changes{before,after}, meta` — append-only.

### SystemSetting
`key*, group[smtp|sms|payment|ai|security|general|feature_flag], value, isSecret, description`

### AiUsage
`company, feature[interview|scoring|report|resume|other], model, inputTokens, outputTokens,
totalTokens, costUsd, latencyMs, success, interview` — powers AI analytics + quota.
```
* = unique index
```
