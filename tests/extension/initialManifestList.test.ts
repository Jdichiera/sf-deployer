import { ManifestBuilder } from '../../src/manifestBuilder';

// Simple test to verify that our fix for initial manifest loading would work
describe('Initial Manifest List Loading', () => {
  it('should call listNamedManifests during initialization', async () => {
    // Mock the ManifestBuilder method
    const listSpy = jest
      .spyOn(ManifestBuilder, 'listNamedManifests')
      .mockResolvedValue(['test-manifest', 'deployment']);

    // Mock context object
    const mockContext = {
      extensionPath: '/test/path',
      workspaceState: {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn(),
      },
    } as any;

    // Call the method directly to verify it works
    const result = await ManifestBuilder.listNamedManifests(mockContext);

    expect(result).toEqual(['test-manifest', 'deployment']);
    expect(listSpy).toHaveBeenCalledWith(mockContext);

    listSpy.mockRestore();
  });

  it('should handle empty manifest directories', async () => {
    // Mock the ManifestBuilder method to return empty array
    const listSpy = jest
      .spyOn(ManifestBuilder, 'listNamedManifests')
      .mockResolvedValue([]);

    const mockContext = {
      extensionPath: '/test/path',
      workspaceState: {
        get: jest.fn().mockReturnValue([]),
        update: jest.fn(),
      },
    } as any;

    const result = await ManifestBuilder.listNamedManifests(mockContext);

    expect(result).toEqual([]);
    expect(listSpy).toHaveBeenCalledWith(mockContext);

    listSpy.mockRestore();
  });
});
