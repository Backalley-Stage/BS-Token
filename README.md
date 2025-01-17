# BSToken

BSToken is an ERC20-based smart contract project, deployed and managed using Truffle. This project distributes tokens among various groups and manages vesting schedules for each group.

## How to Install Truffle

Truffle is a tool that helps in developing, compiling, and deploying smart contracts. Follow these steps to install Truffle:

1. **Install Node.js**: Truffle runs on Node.js, so make sure Node.js is installed on your system. You can download the latest version from the [official Node.js website](https://nodejs.org/).

2. **Install Truffle**: Use the following command to install Truffle globally on your system:

    ```bash
    npm install -g truffle
    ```

    After installation, you can verify the Truffle version with the command:

    ```bash
    truffle version
    ```

## How to Install Dependencies

Follow these steps to install the required dependencies for running the project:

1. **Clone the Project**: Clone the project from GitHub.

    ```bash
    git clone <repository-url>
    ```

2. **Navigate to the Project Folder**: Use the terminal to move into the cloned project directory.

    ```bash
    cd <project-folder>
    ```

3. **Install Dependencies**: Install the dependencies defined in the `package.json` file.

    ```bash
    npm install
    ```

## How to Use

To compile, test, or deploy the project, you can use the following commands:

- **Compile Smart Contracts**:

    ```bash
    truffle compile
    ```

- **Run Tests**:

    ```bash
    truffle test
    ```

- **Deploy Smart Contracts**:

    ```bash
    truffle migrate --network <network-name>
    ```

## License

This project is licensed under the MIT License. For more details, please refer to the LICENSE file.
