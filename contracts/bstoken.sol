// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
//import "@openzeppelin/contracts/Pausable.sol";

contract MyToken is ERC20Burnable, Ownable {
    // ---------------------------------------------------------
    // D-Day: 베스팅 해제 기준 시점 (배포 시 혹은 추후 변경 가능)
    // ---------------------------------------------------------
    uint256 private _dDay;

    // ---------------------------------------------------------
    // 잠금 정보 구조체
    // ---------------------------------------------------------
    struct LockedItem {
        uint256 amount;      // 잠긴 토큰 수량
        uint256 releaseTime; // D-Day + releaseTime 이 현재 시각보다 작아야 해제됨
    }

    // 수혜자(beneficiary) 주소별 잠금 리스트
    mapping(address => LockedItem[]) private _lockedItems;

    constructor(uint256 initialDDay) ERC20("BSToken", "BST") {
        _dDay = initialDDay;
        uint256 totalSupplyAmount = 1_000_000_000 * 10**decimals();
        _mint(msg.sender, totalSupplyAmount);
    }

    // ---------------------------------------------------------
    // 관리(오너)용 함수
    // ---------------------------------------------------------
    function setDDay(uint256 dDay) external onlyOwner {
        _dDay = dDay;
    }

    function getDDay() external view returns (uint256) {
        return _dDay;
    }

    /**
     * @dev Pausable: 오너가 토큰 전송을 일시중지할 수 있음
     */

    // ---------------------------------------------------------
    // 락(베스팅) 관련 조회
    // ---------------------------------------------------------
    function lockedItemsOf(address beneficiary) external view returns (LockedItem[] memory) {
        return _lockedItems[beneficiary];
    }

    /**
     * @dev 현재 시각 기준 '아직 잠겨있는' 토큰 총합을 계산
     */
    function lockedAmount(address beneficiary) public view returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < _lockedItems[beneficiary].length; i++) {
            LockedItem memory item = _lockedItems[beneficiary][i];
            if (_dDay + item.releaseTime > block.timestamp) {
                total += item.amount;
            }
        }
        return total;
    }

    // ---------------------------------------------------------
    // allocate(배분) 예시
    //  - 특정 beneficiary에게 amount만큼 전송하면서
    //    잠금 스케줄을 등록 (cliff, 주기, 비율 등은 직접 계산하여 push)
    // ---------------------------------------------------------
    function allocateWithLock(
        address beneficiary,
        uint256 amount,
        uint256 cliffInDays,
        uint256 periodInDays,
        uint256 times // 몇 번에 걸쳐 분할할지
    ) external onlyOwner {
        require(balanceOf(msg.sender) >= amount, "Owner not enough tokens");


        uint256 eachUnlockAmount = amount / times;
        uint256 aDay = 24 * 3600;

        // 첫 해제: cliffInDays 후
        // 이후 periodInDays 간격으로 times번 push
        for (uint256 i = 0; i < times; i++) {
            _lockedItems[beneficiary].push(
                LockedItem({
                    amount: eachUnlockAmount,
                    releaseTime: (cliffInDays + periodInDays * i) * aDay
                })
            );
        }

        // 토큰 전송 (받는 주소에는 amount 잔액이 찍히지만, lockedItems로 인해 전송이 제한)
        _transfer(msg.sender, beneficiary, amount);
    }

    // ---------------------------------------------------------
    // 핵심: _beforeTokenTransfer, _transfer 오버라이드로 잠긴 물량 전송 방지
    // ---------------------------------------------------------
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // Pausable
        bool temp = true;
        super._beforeTokenTransfer(from, to, amount);
        require(!temp, "BSToken: insufficient unlocked balance");
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        // 먼저 '이미 해제된' LockedItem은 제거(가스 최적화 목적)
        _clearUnlockedItems(from);

        // (잔액 - 잠긴물량) >= 전송액 이어야 함
        require(
            balanceOf(from) >= lockedAmount(from) + amount,
            "BSToken: insufficient unlocked balance"
        );
        super._transfer(from, to, amount);
    }

    /**
     * @dev 실제로 해제된 아이템은 배열 pop()으로 제거
     */
    function _clearUnlockedItems(address account) internal {
        while (
            _lockedItems[account].length > 0 &&
            _dDay + _lockedItems[account][_lockedItems[account].length - 1].releaseTime 
                <= block.timestamp
        ) {
            _lockedItems[account].pop();
        }
    }
}
