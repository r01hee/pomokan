class PomodoroComponent extends BlazeComponent {

  onCreated()
  {
    super.onCreated();
    this.intervalId = null;
    this.fgColor = "#DF3447";
    this.fgColorBreak = "#87CEFA";
    this.fgColorDisable = "#C0C0C0";
    this.bgColor = "#FFFFFF";
    this.fontSize = 20;
    this.font = `${this.fontSize}pt Arial`;
    this.marginToIcon = 10;
    this.iconSize = 30;
    this.cardId = null;

    this.subscribeHandle = Meteor.subscribe('pomodoro', {
      onReady: () => {
        this.init();
      }
    });
  }

  drawProgress(canvas, elapsedTime, endTime, flags)
  {
    const { isWorking, isBreak, isEnable } = flags;
    const endTime_sec = Math.round(endTime / 1000);
    const elapsedTime_sec = Math.round(elapsedTime / 1000);
    const _diff = endTime_sec - elapsedTime_sec;
    const remainingTime = _diff > 0 ? _diff : 0;
    const progress = _diff > 0  ? elapsedTime_sec / endTime_sec : 1;
    const remainingTimeMin = Math.floor(remainingTime / 60);
    const remainingTimeSec = remainingTime - (remainingTimeMin * 60);
    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = centerX < centerY ? centerX : centerY;

    const centerRadius = maxRadius * 0.6;

    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 0;
    ctx.fillStyle = isBreak ? this.fgColorBreak : (isEnable ? this.fgColor : this.fgColorDisable);
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    const startAngle = Math.PI * (2.0 * progress + 1.5);
    const endAngle = Math.PI * 3.5;
    ctx.arc(centerX, centerY, maxRadius, startAngle, endAngle, false);
    ctx.arc(centerX, centerY, centerRadius, endAngle, startAngle, true);
    ctx.fill();
    ctx.font = this.font;
    ctx.textAlign = 'center';
    ctx.fillText(`${('0' + remainingTimeMin).slice(-2)}:${('0' + remainingTimeSec).slice(-2)}`, centerX, centerY + this.fontSize / 2 - this.marginToIcon);

    if (isBreak || isEnable) {
      const drawIcon = isWorking ? this.drawSuspendIcon : this.drawWorkIcon;
      drawIcon(ctx, centerX - this.iconSize / 2, centerY + this.marginToIcon, this.iconSize);
    }
  }

  drawWorkIcon(ctx, x, y, size)
  {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y + (size / 2));
    ctx.lineTo(x, y + size);
    ctx.closePath();
    ctx.fill();
  }

  drawSuspendIcon(ctx, x, y, size)
  {
    const x_size = size / 5;
    ctx.beginPath();
    ctx.fillRect(x + x_size * 1, y, x_size, size);
    ctx.beginPath();
    ctx.fillRect(x + x_size * 3, y, x_size, size);
  }

  draw(pomodoro)
  {
    const user = Meteor.user();
    const card = Cards.findOne(Session.get('currentCard'));
    if (!card) {
      return;
    }
    const flags = {
      isWorking: pomodoro.isWorking(),
      isBreak: pomodoro.isBreak(),
      isEnable: pomodoro.canCardWork(card._id),
    };
    this.drawProgress(this.canvas, pomodoro.elapsedTime(), pomodoro.workTime(), flags);
  }

  onRendered()
  {
    super.onRendered();
    this.init();
  }

  init()
  {
    if (this.subscribeHandle.ready() && this.isRendered()) {
      this.canvas = this.find("#pomodoroProgress");

      let pomodoro = this.getPomodoro();
        if (!pomodoro) {
          Pomodoro.insert(Pomodoro.defaultSchema);
          pomodoro = this.getPomodoro();
        }

      this.workTimer(pomodoro);
    }
  }

  onLoadCanvas()
  {
    const cardId = Cards.findOne(Session.get('currentCard'))._id;
    if (cardId != this.cardId) {
      this.init();
    }
  }

  events()
  {
    return [{
      'click #pomodoroProgress': this.onClickProgress,
    }];
  }

  workTimer(pomodoro)
  {
    this.draw(pomodoro);

    if (!pomodoro.isWorking() || this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      const _pomodoro = this.getPomodoro();
      if (_pomodoro.isOverTime() || !_pomodoro.isWorking()) {
        this.cancelTimerInterval();
      }
      this.draw(_pomodoro);
    }, 1000);
  }

  suspendTimer(pomodoro)
  {
    pomodoro.suspend();
    Pomodoro.clearTimeout();
    this.cancelTimerInterval();
    this.draw(this.getPomodoro());
  }

  cancelTimerInterval()
  {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  startTimer(pomodoro)
  {
    const cardId = Cards.findOne(Session.get('currentCard'))._id;
    pomodoro.start(cardId);
    pomodoro = this.getPomodoro();
    Pomodoro.setTimeout(pomodoro);
    this.workTimer(pomodoro);
  }

  getPomodoro()
  {
    return Pomodoro.findOne();
  }

  onClickProgress()
  {
    if (!this.subscribeHandle.ready()) {
      return;
    }
    const pomodoro = this.getPomodoro();
    const cardId = Cards.findOne(Session.get('currentCard'))._id;
    if (!pomodoro.isBreak() && !pomodoro.canCardWork(cardId)) {
      return;
    }
    if (!pomodoro.isWorking()) {
      this.startTimer(pomodoro);
    } else {
      this.suspendTimer(pomodoro);
    }
  }

  cardPomodoroCount() {
    const cardId = Cards.findOne(Session.get('currentCard'))._id;
    const cardPomodoro = CardPomodoro.findOne({cardId});
    return (cardPomodoro ? cardPomodoro.count : 0);
  }
}

PomodoroComponent.register('cardPomodoro');
