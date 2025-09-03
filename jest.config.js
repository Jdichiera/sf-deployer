module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/tests/__mocks__/vscode.ts',
  },
};
