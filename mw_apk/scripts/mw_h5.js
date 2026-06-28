
/**
 * 一键日常
 */
dailyTask = function() {
	SocketConnection.send(46301, [1, 0]) //抽刻印
	SocketConnection.send(42395, [111, 4, 1, 0]) //接取SPT悬赏任务
	SocketConnection.send(42395, [111, 4, 2, 0]) //SPT悬赏
	SocketConnection.send(42395, [111, 4, 3, 0]) //SPT悬赏
	for (var i = 0; i < 5; i++) {
		SocketConnection.send(CommandID.RES_PRODUCTORBUY, [2, 0]) //战队生产
	}
	BubblerManager.getInstance().showText("日常领取完成")
}

/**
 * 判断是否在战斗中,true表示在战斗中
 */
//isFighting = function() {
//	var f = FightManager.isFighting == true ? true : false
//	return f
//}

/**
 * 战斗是否结束
 */
//isFightOver = function() {
//	var f FightOverController.isFightOver == true
//	return f
//}

/**
 * 自动84
 */
//auto84 = function() {
//	if (PetManager.infos.length <= 2) return "当前背包精灵不足3只"
//	// 检查是否有帝皇之御
//	var dhzy = PetManager.containsBagForID(3512)
//	// 检查是否有幻影蝶
//	var hyd = PetManager.containsBagForID(2724)
//	// 检查是否有六界帝神
//	var ljds = PetManager.containsBagForID(3329)
//	// 检查是否有六界神王
//	var ljsw = PetManager.containsBagForID(3045)
//	// 检查是否有龙妈
//	var dlm = PetManager.containsBagForID(3036) //大龙妈
//	var xlm = PetManager.containsBagForID(3035) //小龙妈
//	// 检查是否有圣谱
//	var sp = PetManager.containsBagForID(5000)
//	var zb = 0; //1为表姐，2为碟子
//	//检查帝皇之御/幻影蝶是否首发
//	if (PetManager.infos[0].id != 3512 && PetManager.infos[0].id != 2724) {
//		var dhzy_catchTime = 0,
//			hyd_catchTime = 0
//		for (i = 0, i < PetManager.infos.length, i++) {
//			if (infos[i].id == 3512) dhzy_catchTime = infos[i].catchTime
//			if (infos[i].id == 2724) hyd_catchTime = infos[i].catchTime
//		}
//		if (dhzy_catchTime != 0) {
//			SocketConnection.send(CommandID.CHANGE_PET, dhzy_catchTime); //切表姐
//			zb = 1;
//		} else if (hyd_catchTime != 0) {
//			SocketConnection.send(CommandID.CHANGE_PET, hyd_catchTime); //切碟子
//			zb = 2;
//		}
//	}
//}

/**
 * 开始矿洞，选择难度
 * @param {Object} mode 模式
 */
startTiTan = function(mode) {
	SocketConnection.sendWithPromise(42395, [104, 1, mode, 0])
}

/**
 * 泰坦矿洞进入战斗
 * @param {Object} task 关卡，1，2，4
 */
battleTiTan = function(task) {
	if (mode == 0) return;
	var num = 0;
	timer = window.setInterval(function() {
		var b = isFighting()
		if (b == false) {
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [104, mode, task])
			if (task == 2 && num < 16) {
				num++
			} else {
				task = 3;
				switch (mode) {
					case 1:
						titanEasy(1);
						SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [104, mode, task])
						break
					case 2:
						titanEasy(2);
						break
					case 3:
						titanEasy(3);
						break
				}
			}
			if (task == 1) task == 2
		}
	}, 500)
}

/**
 * 泰坦矿洞一键挖矿
 * @param {type} mode 模式，1~3
 */
titanEasy = function(mode) {
	var easy = [0, 1, 2, 3, 4, 5,
		11, 10, 9, 8, 7, 6,
		12, 13, 14, 15, 16, 17,
		23, 22, 21, 20, 19, 18,
		24, 25, 26, 27, 28, 29
	] //执行25
	var normal = [0, 1, 2, 3, 4, 5, 6, 7,
		15, 14, 13, 12, 11, 10, 9, 8,
		16, 17, 18, 19, 20, 21, 22, 23,
		31, 30, 29, 28, 27, 26, 25, 24,
		32, 33, 34, 35, 36, 37, 38, 39
	] //执行34
	var hard = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
		21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11,
		22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
		43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33,
		44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54
	] //执行48
	switch (mode) {
		case 1:
			for (var i = 1; i < 26; i++) {
				var b = pveTitanHole.DataManger._instance.getStep3GridDataByIdx(easy[i]).unlockFlag
				if (b == false) {
					pveTitanHole.Level3View.prototype.playerMove(easy[i]);
				}
			}
			break;
		case 2:
			for (var i = 1; i < 36; i++) {
				var b = pveTitanHole.DataManger._instance.getStep3GridDataByIdx(normal[i]).unlockFlag
				if (b == false) {
					pveTitanHole.Level3View.prototype.playerMove(normal[i]);
				}
			}
			break;
		case 3:
			for (var i = 1; i < 49; i++) {
				var b = pveTitanHole.DataManger._instance.getStep3GridDataByIdx(hard[i]).unlockFlag
				if (b == false) {
					pveTitanHole.Level3View.prototype.playerMove(hard[i]);
				}
			}
			break;
	}
	BubblerManager.getInstance().showText("一键挖矿完成")
}

/**
 * @param {Object} i 勇者之塔层数，1~30
 */
tower = function(i) {
	var num = 0;
	timer = window.setInterval(function() {
		var b = isFighting()
		if (b == false) {
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 1])
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 2])
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 3])
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 4])
			SocketConnection.send(CommandID.FIGHT_H5_PVE_BOSS, [101, i, 5])
			num++;
			if (num > 5) clearTimer();
		}
	}, 500)
}
