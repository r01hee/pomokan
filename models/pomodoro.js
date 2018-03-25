Pomodoro = new Mongo.Collection('pomodoro');

Pomodoro.STATE = Object.freeze({
  none: 0,
  working: 1,
  shortBreak: 2,
  longBreak: 4,
  break: 6,
});

Pomodoro.attachSchema(new SimpleSchema({
  userId: {
    type: String,
    autoValue() {
      if (this.isInsert && !this.isSet) {
        return this.userId;
      }
    },
  },
  config: {
    type: Object,
  },
  "config.time": {
    type: Number,
  },
  "config.shortBreakTime": {
    type: Number,
  },
  "config.longBreakTime": {
    type: Number,
  },
  "config.longBreakCount": {
    type: Number,
  },
  "config.countPerDay": {
    type: Number,
  },
  startDate: {
    type: Date,
    optional: true
  },
  suspendingTime: {
    type: SimpleSchema.Integer,
  },
  state: {
    type: Number,
  },
  workingCardId: {
    type: String,
    optional: true
  },
  lastEndPomodoroDate: {
    type: Date,
    optional: true
  },
  dateLine: {
    type: Date,
  },
  todayCount: {
    type: SimpleSchema.Integer,
  },
}));

Pomodoro.defaultSchema = Object.freeze({
  config: Object.freeze({
    time: 25 * 60 * 1000,
    shortBreakTime: 5 * 60 * 1000,
    longBreakTime: 15 * 60 * 1000,
    longBreakCount: 4,
    countPerDay: 10,
  }),
  startDate: null,
  suspendingTime: 0,
  state:Pomodoro.STATE.none,
  workingCardId: null,
  lastEndPomodoroDate: null,
  dateLine: new Date(1970,1,1,0,0,0),
  todayCount: 0,
});


Pomodoro.allow({
  insert(userId, doc) {
    return doc.userId == userId;
  },

  update(userId, doc) {
    return doc.userId == userId;
  },

  remove(userId, doc) {
    return doc.userId == userId;
  },

  fetch: ['userId'],
});

Pomodoro.helpers({
  elapsedTime()
  {
    const { startDate, suspendingTime } = this;
    return (startDate ? (Date.now() - startDate.getTime())  : 0) + suspendingTime;
  },

  isOverTime()
  {
    if (this.elapsedTime() >= this.workTime()) {
      return true;
    }
    return false;
  },

  canCardWork(cardId) {
    return !this.workingCardId || this.workingCardId == cardId;
  },

  isBreak() {
    return this.state & Pomodoro.STATE.break;
  },

  isWorking() {
    return this.state & Pomodoro.STATE.working;
  },

  workTime() {
    const { state } = this;
    if (state & Pomodoro.STATE.shortBreak) {
      return this.config.shortBreakTime;
    }
    if (state & Pomodoro.STATE.longBreak) {
      return this.config.longBreakTime;
    }
    return this.config.time;
  },

  actualTodayCount() {
    const todayCount = this.todayCount || 0;
    if (!this.lastEndPomodoroDate) {
      return todayCount;
    }

    const now = new Date();
    const dateLine = new Date(this.dateLine.getTime());
    dateLine.setFullYear(now.getFullYear());
    dateLine.setMonth(now.getMonth());
    dateLine.setDate(now.getDate());
    if (this.lastEndPomodoroDate.getTime() < dateLine.getTime() &&
        dateLine.getTime() <= now.getTime() ) {
      return 0;
    } else {
      return todayCount;
    }
  },
});

Pomodoro.mutations({
  start(cardId)
  {
    return {$set: {
      startDate: new Date(),
      workingCardId: cardId,
      state: this.state | Pomodoro.STATE.working
    }};
  },

  finish()
  {
    const { lastEndPomodoroDate } = this;
    const { longBreakCount } = this.config;
    let todayCount = this.actualTodayCount();
    const now = new Date();

    let state = Pomodoro.STATE.none;

    if (!this.isBreak()) {
      todayCount++;

      state = (todayCount % longBreakCount) == 0 ? Pomodoro.STATE.longBreak : Pomodoro.STATE.shortBreak;

      if (this.workingCardId) {
        let cardPomodoro = CardPomodoro.findOne({cardId: this.workingCardId});
        if (!cardPomodoro) {
          CardPomodoro.insert({cardId: this.workingCardId, count: 0});
          cardPomodoro = CardPomodoro.findOne({cardId: this.workingCardId});
        }
        cardPomodoro.incrementCount();
      }
    }


    return {$set: {
      startDate: null,
      suspendingTime: 0,
      state: state,
      workingCardId: null,
      todayCount: todayCount,
      lastEndPomodoroDate: now,
    }};
  },

  suspend()
  {
    return {$set: {
      startDate: null,
      suspendingTime: this.elapsedTime(),
      state: this.state & (~Pomodoro.STATE.working),
    }};
  },

  setWorkingCardId(cardId)
  {
    return {$set: {'workingCardId': cardId}};
  },
});


if (Meteor.isServer) {
  Meteor.startup(() => {
    Pomodoro._collection._ensureIndex({ userId: 1 });
  });
}

if (Meteor.isClient) {
  Pomodoro.setTimeout = function(pomodoro) {
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission(function (status) {
        if (Notification.permission !== status) {
          Notification.permission = status;
        }
      });
    }

    if (!pomodoro || !pomodoro.isWorking()) {
      return;
    }

    let delay = pomodoro.workTime() - pomodoro.elapsedTime();
    if (delay < 0) {
      delay = 0;
    }
    Pomodoro.clearTimeout();
    Pomodoro.timeoutID = setTimeout(()=> {
      const _pomodoro = Pomodoro.findOne();
      _pomodoro.finish();
      const message = TAPi18n.__(pomodoro.isBreak ? 'end-pomodoro-break-notification' : 'end-pomodoro-notification');
      Pomodoro.timeoutID = null;
      if (window.Notification && Notification.permission === "granted") {
        const n = new Notification(message);
      } else {
        alert(message);
      }
    }, delay);
  };

  Pomodoro.clearTimeout = function() {
    if (Pomodoro.timeoutID) {
      clearTimeout(Pomodoro.timeoutID);
      Pomodoro.timeoutID = null;
    }
  };
}
