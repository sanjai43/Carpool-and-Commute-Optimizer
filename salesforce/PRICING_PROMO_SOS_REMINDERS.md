# CarShary: Pricing + Rewards + SOS + Reminders (Salesforce)

## Deploy
From repo root:

```bash
cd salesforce
sf project deploy start -o MyOrgT
```

## Pricing (auto)
- Fields on `Ride__c` compute `SuggestedFare__c` and `PerRiderFare__c`.
- Trigger `CarSharyRideRequestPricing` keeps:
  - `Ride__c.AcceptedCount__c` updated
  - `RideRequest__c.Fare__c` updated for all `Accepted` riders

## Rewards / Promo codes (auto)
- When a ride becomes `Completed`, trigger `CarSharyRidePromoReward` creates a `PromoCode__c` per accepted rider.
- Rewards are demo-friendly: **10% off**, max uses **1**, expires in **7 days**.

## SOS (auto)
- When an `Incident__c` is created with `Type__c = SOS`, trigger `CarSharyIncidentTrigger`:
  - sets `Flagged__c=true`
  - sets `Status__c=Escalated`
  - creates a High priority `Task` for the most recently active SysAdmin

## Reminders (schedule once)
This creates a chat-style reminder message (`Message__c`) for rides departing within the next 20 minutes.

Run **once** in Salesforce:
- Setup → **Developer Console**
- Debug → **Open Execute Anonymous Window**
- Run:

```apex
CarSharySchedulerSetup.scheduleRideReminders();
```

To test immediately without scheduling:

```apex
CarSharyRideReminderJob.runOnce();
```

## Apex REST (optional, recommended)
For stable demos (and to avoid Field-Level Security surprises), deploy `CarSharyApi`:

- `GET /services/apexrest/carshary/v1/eco?userId=<AppUser__c Id>`
- `GET /services/apexrest/carshary/v1/promos?userId=<AppUser__c Id>`
- `GET /services/apexrest/carshary/v1/earnings?userId=<AppUser__c Id>`

Backend will call these automatically when Salesforce mode is enabled, and fall back to SOQL if Apex REST isn’t available.
