const { network, ethers } = require("hardhat");
const { verify } = require("../utils/verify");
const {
  developmentChains,
  networkConfig,
} = require("../helper-hardhat-config");

const VRF_SUB_FUND_AMT = ethers.utils.parseEther("2");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  let coordinatorAddress, subscriptionId;

  if (developmentChains.includes(network.name)) {
    const VRFCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    coordinatorAddress = VRFCoordinatorV2Mock.address;

    const transactionResponse = await VRFCoordinatorV2Mock.createSubscription();
    const transactionReceipt = await transactionResponse.wait(1);
    subscriptionId = transactionReceipt.events[0].args.subId;
    await VRFCoordinatorV2Mock.fundSubscription(
      subscriptionId,
      VRF_SUB_FUND_AMT
    );
  } else {
    coordinatorAddress = networkConfig[chainId]["vrfCoordinatorV2"];
    subscriptionId = networkConfig[chainId]["subscriptionId"];
  }

  log("Deploying Raffle and waiting for confirmations...");

  const entranceFee = networkConfig[chainId]["entranceFee"];
  const gasLane = networkConfig[chainId]["gasLane"];
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
  const interval = networkConfig[chainId]["interval"];
  const args = [
    coordinatorAddress,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const Raffle = await deploy("Raffle", {
    from: deployer,
    log: true,
    args: args,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(Raffle.address, args);
  }

  log("Contract deployed!");
  log("-----------------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
