// test/MyToken.test.js

const { expect } = require("chai");
const { ethers } = require("hardhat"); // 만약 Truffle가 아닌 Hardhat 사용 시
// -- Truffle에서 Mocha+Chai를 사용한다면 'ethers' 대신 Web3를, 
//    또는 @truffle/contract를 이용하셔도 됩니다. 
//    아래 예시는 Hardhat 스타일이지만, Truffle 환경에서도 유사하게 작성 가능.

const timeTravel = async (seconds) => {
  // Truffle/Hardhat에서 시간이동.
  // Hardhat의 경우 evm_increaseTime + evm_mine
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
};

describe("MyToken (BST)", function () {
  let MyToken, myToken;
  let owner, addr1, addr2;

  before(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    // 트러플 환경에서는 `accounts[0], accounts[1]...` 이런 식으로 받습니다.
    // 예: const MyToken = artifacts.require("MyToken"); 
  });

  beforeEach(async function () {
    // 배포
    MyToken = await ethers.getContractFactory("MyToken");
    // initialDDay=0으로 배포 (혹은 지금 시점)
    myToken = await MyToken.deploy(0); 
    await myToken.deployed();
  });

  it("배포 시: 총발행량이 owner에게 할당되어야 함", async function () {
    const totalSupply = await myToken.totalSupply();
    const ownerBal = await myToken.balanceOf(owner.address);
    expect(ownerBal).to.equal(totalSupply);
  });

  it("setDDay() 테스트", async function () {
    // 초기 DDay == 0
    expect(await myToken.getDDay()).to.equal(0);
    // 새로 설정
    await myToken.setDDay(1000);
    expect(await myToken.getDDay()).to.equal(1000);
  });

  it("pause / unpause 테스트", async function () {
    // pause
    await myToken.pause();
    // pause상태에서 transfer 시도
    await expect(
      myToken.transfer(addr1.address, 100)
    ).to.be.revertedWith("MyToken: token transfer while paused");

    // unpause
    await myToken.unpause();
    await myToken.transfer(addr1.address, 100);
    const addr1Bal = await myToken.balanceOf(addr1.address);
    expect(addr1Bal).to.equal(100);
  });

  it("allocateWithLock()로 잠금 후 전송이 막히는지 확인", async function () {
    // owner -> addr1 에게 1000토큰을 2번 분할(=500씩)로 락
    // cliff=1일(1440분) / period=1일 / times=2
    await myToken.allocateWithLock(addr1.address, 1000, 1, 1, 2);

    // addr1의 잔액은 1000이지만, 전부 잠김 (unlock 전)
    expect(await myToken.balanceOf(addr1.address)).to.equal(1000);

    // lockedAmount(addr1) == 1000
    let lockedBal = await myToken.lockedAmount(addr1.address);
    expect(lockedBal).to.equal(1000);

    // addr1 -> addr2 전송 시도 => 실패해야 함
    await expect(
      myToken.connect(addr1).transfer(addr2.address, 100)
    ).to.be.revertedWith("MyToken: insufficient unlocked balance");

    // 이제 시간 진행 전이므로 lockedItems가 아직 유효
    const lockedItems = await myToken.lockedItemsOf(addr1.address);
    expect(lockedItems.length).to.equal(2);
    // 대충 releaseTime이 cliff+period 계산값인지 확인 가능
  });

  it("시간이 지나면 잠금 해제되어 전송 가능해지는지 확인", async function () {
    // DDay를 지금(block.timestamp)라고 가정
    const nowTs = Math.floor(Date.now() / 1000);
    await myToken.setDDay(nowTs);

    // owner -> addr1 allocateWithLock
    // cliffInDays=0, periodInDays=1, times=2 => 
    //   0일 후 첫 분할, 1일 후 두 번째 분할
    await myToken.allocateWithLock(addr1.address, 1000, 0, 1, 2);
    // 배포 후 잔액체크
    expect(await myToken.balanceOf(addr1.address)).to.equal(1000);
    expect(await myToken.lockedAmount(addr1.address)).to.equal(1000);

    // 현재는 첫 chunk도 아직 안 풀림 (DDay+0 days <= block.timestamp?)
    // 사실 cliff=0이면 첫 chunk는 즉시 해제될 수도 있지만,
    // releaseTime = (0 + periodInDays*i)*86400 로 계산:
    //   i=0 => 0 * 86400 = 0 => 즉시 해제
    //   i=1 => 1 * 86400 = 86400
    // => 첫 chunk는 즉시 unlock이어야 함 => locked=500

    // clearUnlockedItems()는 transfer할 때 자동 호출 -> 정확도 위해 수동확인
    let lockedBal1 = await myToken.lockedAmount(addr1.address);
    // i=0번은 releaseTime=0 => 이미 해제
    // i=1번은 releaseTime=86400 => 아직 잠김
    // => lockedBal1 == 500
    expect(lockedBal1).to.equal(500);

    // addr1가 600 전송 시도 => 실패 (unlocked=500, locked=500, total=1000)
    await expect(
      myToken.connect(addr1).transfer(addr2.address, 600)
    ).to.be.revertedWith("MyToken: insufficient unlocked balance");

    // 500 전송은 가능
    await myToken.connect(addr1).transfer(addr2.address, 500);
    expect(await myToken.balanceOf(addr2.address)).to.equal(500);
    expect(await myToken.balanceOf(addr1.address)).to.equal(500);

    // 아직 500은 잠김
    expect(await myToken.lockedAmount(addr1.address)).to.equal(500);

    // 1일(86400초) 시간 경과 -> 두 번째 chunk도 해제
    await timeTravel(86400); // Hardhat/Truffle에서 시간이동
    // addr1 -> clearUnlockedItems 자동 호출 시 lockedBal=0
    await myToken.connect(addr1).transfer(addr2.address, 100);
    // 이제 locked=0
    expect(await myToken.lockedAmount(addr1.address)).to.equal(0);
    // addr2 최종 600
    expect(await myToken.balanceOf(addr2.address)).to.equal(600);
    // addr1 최종 400
    expect(await myToken.balanceOf(addr1.address)).to.equal(400);
  });
});
