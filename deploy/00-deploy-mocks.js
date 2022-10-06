const { network, ethers } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25");
const GASE_PRICE_LINK = 1e9;

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  if (developmentChains.includes(network.name)) {
    log("Local network detected! Deploying mocks...");

    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: [BASE_FEE, GASE_PRICE_LINK],
    });

    log("Mocks deployed!");
    log("------------------------------------------------------");
  }
};

module.exports.tags = ["all", "mocks"];
