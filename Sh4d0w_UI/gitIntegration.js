// gitIntegration.js
// Git repository information for Shadow UI
// By: NathanGr33n

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

class GitIntegration {
  constructor(logger = null) {
    this.logger = logger;
    this.gitAvailable = false;
    this.checkGitAvailability();
  }

  /**
   * Check if git is available on the system
   */
  async checkGitAvailability() {
    try {
      await this.executeGit(['--version']);
      this.gitAvailable = true;
      if (this.logger) {
        this.logger.debug('Git is available');
      }
    } catch (error) {
      this.gitAvailable = false;
      if (this.logger) {
        this.logger.warn('Git not available on system');
      }
    }
  }

  /**
   * Execute a git command
   * @param {string[]} args - Git command arguments
   * @param {string} cwd - Working directory
   * @returns {Promise<string>} Command output
   */
  executeGit(args, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Check if a directory is a git repository
   * @param {string} dir - Directory to check
   * @returns {Promise<boolean>}
   */
  async isGitRepository(dir) {
    if (!this.gitAvailable) return false;
    
    try {
      await this.executeGit(['rev-parse', '--git-dir'], dir);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current branch name
   * @param {string} cwd - Working directory
   * @returns {Promise<string|null>} Branch name or null
   */
  async getCurrentBranch(cwd = process.cwd()) {
    if (!this.gitAvailable) return null;

    try {
      const branch = await this.executeGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      return branch || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get repository status
   * @param {string} cwd - Working directory
   * @returns {Promise<Object>} Git status information
   */
  async getStatus(cwd = process.cwd()) {
    if (!this.gitAvailable) {
      return { available: false };
    }

    try {
      const isRepo = await this.isGitRepository(cwd);
      if (!isRepo) {
        return { available: true, isRepository: false };
      }

      const [branch, statusOutput, ahead, behind] = await Promise.all([
        this.getCurrentBranch(cwd),
        this.executeGit(['status', '--porcelain'], cwd).catch(() => ''),
        this.getAheadBehind(cwd, 'ahead').catch(() => 0),
        this.getAheadBehind(cwd, 'behind').catch(() => 0),
      ]);

      // Parse status output
      const lines = statusOutput.split('\n').filter(l => l.trim());
      const staged = lines.filter(l => l[0] !== ' ' && l[0] !== '?').length;
      const unstaged = lines.filter(l => l[1] !== ' ' && l[0] !== '?').length;
      const untracked = lines.filter(l => l.startsWith('??')).length;

      return {
        available: true,
        isRepository: true,
        branch: branch || 'unknown',
        staged,
        unstaged,
        untracked,
        ahead: parseInt(ahead) || 0,
        behind: parseInt(behind) || 0,
        clean: lines.length === 0,
      };
    } catch (error) {
      if (this.logger) {
        this.logger.debug('Git status error:', error.message);
      }
      return { available: true, isRepository: false };
    }
  }

  /**
   * Get commits ahead/behind remote
   * @param {string} cwd - Working directory
   * @param {string} type - 'ahead' or 'behind'
   * @returns {Promise<number>}
   */
  async getAheadBehind(cwd, type) {
    try {
      const output = await this.executeGit(
        ['rev-list', '--count', `@{u}..HEAD`],
        cwd
      );
      if (type === 'ahead') {
        return parseInt(output) || 0;
      }
      
      const behindOutput = await this.executeGit(
        ['rev-list', '--count', `HEAD..@{u}`],
        cwd
      );
      return parseInt(behindOutput) || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get recent commits
   * @param {string} cwd - Working directory
   * @param {number} count - Number of commits to retrieve
   * @returns {Promise<Array>} Array of commit objects
   */
  async getRecentCommits(cwd = process.cwd(), count = 10) {
    if (!this.gitAvailable) return [];

    try {
      const isRepo = await this.isGitRepository(cwd);
      if (!isRepo) return [];

      const output = await this.executeGit(
        ['log', `-${count}`, '--pretty=format:%H|%an|%ar|%s'],
        cwd
      );

      return output.split('\n').filter(l => l.trim()).map(line => {
        const [hash, author, time, message] = line.split('|');
        return {
          hash: hash.substring(0, 7),
          author,
          time,
          message,
        };
      });
    } catch (error) {
      return [];
    }
  }

  /**
   * Get remote URL
   * @param {string} cwd - Working directory
   * @returns {Promise<string|null>}
   */
  async getRemoteUrl(cwd = process.cwd()) {
    if (!this.gitAvailable) return null;

    try {
      const url = await this.executeGit(['remote', 'get-url', 'origin'], cwd);
      return url || null;
    } catch (error) {
      return null;
    }
  }
}

module.exports = GitIntegration;
