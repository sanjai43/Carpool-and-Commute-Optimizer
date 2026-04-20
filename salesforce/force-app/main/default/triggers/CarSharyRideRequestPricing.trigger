trigger CarSharyRideRequestPricing on RideRequest__c (after insert, after update, after delete, after undelete) {
  Set<Id> rideIds = new Set<Id>();

  if (Trigger.isInsert || Trigger.isUpdate || Trigger.isUndelete) {
    for (RideRequest__c rr : Trigger.new) {
      if (rr.Ride__c != null) rideIds.add(rr.Ride__c);
    }
  }

  if (Trigger.isDelete) {
    for (RideRequest__c rr : Trigger.old) {
      if (rr.Ride__c != null) rideIds.add(rr.Ride__c);
    }
  }

  if (!rideIds.isEmpty()) {
    CarSharyPricingService.handleRideRequestChange(rideIds);
  }
}

