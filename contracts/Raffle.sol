// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughEntranceETH();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 balance,
    uint256 numPlayers,
    uint256 raffleState
);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    address payable s_winner;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;

    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    RaffleState private s_RaffleState;

    event RaffleEnter(address indexed player);
    event RequestRaffleWinner(uint256 indexed requestId);
    event WinnerSelected(address indexed winner);

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_entranceFee = entranceFee;
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_interval = interval;
        s_lastTimeStamp = block.timestamp;
        s_RaffleState = RaffleState.OPEN;
    }

    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughEntranceETH();
        }
        if (s_RaffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));
        emit RaffleEnter(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (
            bool upKeepNeeded,
            bytes memory /* performData */
        )
    {
        bool isOpen = s_RaffleState == RaffleState.OPEN;
        bool timePassed = (block.timestamp - s_lastTimeStamp) > i_interval;
        bool hasPlyrs = s_players.length > 0;
        bool hasBalance = address(this).balance > 0;
        upKeepNeeded = (isOpen && timePassed && hasPlyrs && hasBalance);
        return (upKeepNeeded, "0x0");
    }

    function performUpkeep(
        bytes calldata /* checkData */
    ) external override {
        (bool upKeepNeeded, ) = checkUpkeep("");
        if (!upKeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_RaffleState)
            );
        }
        s_RaffleState = RaffleState.CALCULATING;
        uint256 s_requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        emit RequestRaffleWinner(s_requestId);
    }

    function fulfillRandomWords(
        uint256, /* requestId */
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        s_winner = s_players[indexOfWinner];
        s_RaffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool success, ) = s_winner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerSelected(s_winner);
    }

    function getEntranceFees() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getWinner() public view returns (address) {
        return s_winner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_RaffleState;
    }

    function getNumWords() public pure returns (uint256) {
        return NUM_WORDS;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }
}
