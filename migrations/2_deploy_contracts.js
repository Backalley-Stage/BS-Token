const MyToken = artifacts.require("MyToken");

module.exports = function (deployer) {
  const nowTimestamp = Math.floor(Date.now() / 1000);
  // D-Day를 지금 시점(또는 조금 뒤)으로 설정
  deployer.deploy(MyToken, nowTimestamp);
};
