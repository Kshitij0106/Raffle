const { run } = require("hardhat");

const verify = async (address, args) => {
  console.log("Verifying Contract");

  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: args,
    });
  } catch (err) {
    if (err.message.toLowerCase().includes("already verified")) {
      console.log("Already Verified");
    } else {
      console.log(err);
    }
  }
};

module.exports = { verify };
