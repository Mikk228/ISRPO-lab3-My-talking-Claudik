import * as vscode from 'vscode';

const LINE_WIDTH = 70;

interface GlobalPhrases {
    phrases: string[];
    priority: number;
};

const phrase_welcome: GlobalPhrases = {
    phrases: [
        "Ready to write some code?",
        "Hey! I missed this workspace.",
        "Another day, another bug.",
        "I'm awake! Let's get to work.",
        "What are we building today?",
        "Welcome back, developer!",
    ],
    priority: 1,
};

const phrase_commit: GlobalPhrases = {
    phrases: [
        "Saved in history forever!",
        "Git happens!",
        "Commit successful. I'm proud!",
        "Another piece of the puzzle!",
    ],
    priority: 2,
};

const phrase_fix_error: GlobalPhrases = {
    phrases: [
        "Wait... did we fix it?",
    ],
    priority: 3,
};

const phrase_working: GlobalPhrases = {
    phrases: [
        "Interesting approach...",
        "One line at a time.",
        "Code is poetry!",
        "Focus mode: activated.",
        "This is getting exciting!"
    ],
    priority: 0,
};

const PRIORITY_ERROR = 4;

const LEVELS = [
    { title: 'Intern', xp: 0 },
    { title: 'Junior', xp: 500 },
    { title: 'Middle', xp: 1500 },
    { title: 'Senior', xp: 3500 },
];

function GetLevelIndex(xp: number): number {
    let index = 0;
    LEVELS.forEach((level, i) => {
        if (xp >= level.xp) {
            index = i;
        }
    });
    return index;
}
 
function BuildLevelLine(xp: number): string {
    const index = GetLevelIndex(xp);
    const lvl = LEVELS[index];
    const next = LEVELS[index + 1];
 
    if (!next) {
        return `${lvl.title}  [${'█'.repeat(10)}] MAX`;
    }
 
    const ratio = (xp - lvl.xp) / (next.xp - lvl.xp);
    const filled = Math.min(10, Math.floor(ratio * 10));
    return `${lvl.title}  [${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] -> ${next.title}`;
}

let current = { text: '', until: 0, priority: 0 };
let error_now = false;
let terminal: vscode.Terminal | undefined;

function BuildFrames(hash: string, branch: string, changes: number, experience: number, state_xp: string, phrase: string): string[][] {
    const head = [
        ' $ claudik',
        '',
        `   * ${phrase}`,
        '',
    ];
    const tail = [
        '       ▝▜█████▛▘',
        '         ▘▘ ▝▝',
        '',
        `   > branch: ${branch}     > last commit hash: ${hash}`,
        `   > changes: ${changes}`,
        `   > experience: ${experience}xp   ${state_xp}`,
        `   > level: ${BuildLevelLine(experience)}`,
    ];
    return [
        [...head, '        ▐▛███▜▌', ...tail],
        [...head, '        ▐█████▌', ...tail],
        [...head, '        ▐▛███▜▌', ...tail],
    ];
}

function Say(text: string, show_time: number, priority: number) {
    if (Date.now() < current.until && priority < current.priority) {
        return;
    }
    current = { 
        text,
        until: Date.now() + show_time,
        priority
    };
}

function GetRandomPhrase(type_phrase: GlobalPhrases = phrase_working, show_time: number = 4000) {
    const text = type_phrase.phrases[Math.floor(Math.random() * type_phrase.phrases.length)];
    Say(text, show_time, type_phrase.priority);
}

function CheckPhrasesTime() {
    if (Date.now() > current.until) {
        GetRandomPhrase();
    }
}

function UpdateErrors() {
    const errorCount = vscode.languages.getDiagnostics().flatMap(([, diags]) => diags).filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;

    if (errorCount > 0) {
        current = {
            text: `Oops... Detected ${errorCount} error(s)`,
            until: Infinity,
            priority: PRIORITY_ERROR
        };
        error_now = true;
    } else if (error_now) {
        error_now = false;
        current.until = 0;
        GetRandomPhrase(phrase_fix_error, 2000);
    }
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {
        if (terminal) {
            terminal.show();
            return;
        }

        let experience: number = context.globalState.get<number>('experience', 0);

        let state_xp: string = '';
        let time_xp_show = 0;

        async function AddExperience(amount: number) {
            const level_before = GetLevelIndex(experience);

            experience += amount;
            state_xp = `+ ${amount}xp`;
            time_xp_show = Date.now() + 4000;

            const level_after = GetLevelIndex(experience);

            if (level_after > level_before) {
                Say(
                    `Level up! You are now ${LEVELS[level_after].title}!`,
                    5000,
                    2
                );
            }

            await context.globalState.update('experience', experience);
        }

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showWarningMessage('Не удалось определить gitExtension');
            return;
        }

        const activated_extension = await gitExtension.activate();
        const gitAPI = activated_extension.getAPI(1);
        const repository = gitAPI.repositories[0];

        if (!repository) {
            vscode.window.showWarningMessage('Не удалось определить repository');
            return;
        }

        const hash_key = `prev_hash:${repository.rootUri.toString()}`;
        let prev_hash: string = context.globalState.get<string>(hash_key, '');
        let prev_branch: string | undefined = repository.state.HEAD?.name;

        const writeEmitter = new vscode.EventEmitter<string>();
        let frame_index = 0;
        let timer: NodeJS.Timeout | undefined;
        let state_sub: vscode.Disposable | undefined;

        const RenderFrame = (advance: boolean = false) => {
            const hash: string | undefined = repository.state.HEAD?.commit;
            const branch: string | undefined = repository.state.HEAD?.name;
            const changes =
                (repository.state.workingTreeChanges?.length ?? 0) +
                (repository.state.indexChanges?.length ?? 0) +
                (repository.state.mergeChanges?.length ?? 0);

            experience = context.globalState.get<number>('experience', 0);

            if (hash && hash !== prev_hash) {
                if (prev_hash && branch === prev_branch) {
                    AddExperience(50);
                    GetRandomPhrase(phrase_commit, 3000);
                }
                prev_hash = hash;
                context.globalState.update(hash_key, prev_hash);
            }
            prev_branch = branch;

            state_xp = Date.now() < time_xp_show ? state_xp : '';

            CheckPhrasesTime();

            const frames = BuildFrames((hash ?? 'No commits yet').slice(0, 7), branch ?? 'No branch', changes, experience, state_xp, current.text);

            let output = '\x1b[H';

            for (const line of frames[frame_index]) {
                output += line.slice(0, LINE_WIDTH).padEnd(LINE_WIDTH, ' ') + '\r\n';
            }

            writeEmitter.fire(output);

            if (advance) {
                frame_index = (frame_index + 1) % frames.length;
            }
        };

        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                writeEmitter.fire('\x1b[2J\x1b[?25l');
                GetRandomPhrase(phrase_welcome, 5000);
                UpdateErrors();
                RenderFrame();
                timer = setInterval(() => RenderFrame(true), 500);
                state_sub = repository.state.onDidChange(() => RenderFrame());
            },
            close: () => {
                if (timer) {
                    clearInterval(timer);
                    timer = undefined;
                }
                state_sub?.dispose();
                writeEmitter.dispose();
                terminal = undefined;
            },
        };

        terminal = vscode.window.createTerminal({
            name: 'Claudik Terminal',
            pty,
        });
        terminal.show();
    });

    const diagnosticListener = vscode.languages.onDidChangeDiagnostics(() => {
        UpdateErrors();
    });

    context.subscriptions.push(diagnosticListener);
    context.subscriptions.push(disposable);

    context.subscriptions.push(
        vscode.commands.registerCommand('my-talking-claudik.plusXP', async () => {
            await context.globalState.update('experience', context.globalState.get<number>('experience', 0) + 500);
            vscode.window.showInformationMessage('XP increased by 500!');
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('my-talking-claudik.minusXP', async () => {
            await context.globalState.update('experience', Math.max(0, context.globalState.get<number>('experience', 0) - 500));
            vscode.window.showInformationMessage('XP decreased by 500!');
        })
    );
}

export function deactivate() {}