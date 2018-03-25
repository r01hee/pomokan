Meteor.publish('pomodoro', function() {
  return Pomodoro.find({userId: this.userId});
});
