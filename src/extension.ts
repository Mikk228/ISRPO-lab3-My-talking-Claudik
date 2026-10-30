import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('my-talking-claudik.showInTerminal', async () => {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showWarningMessage('Не удалось определить gitExtension');
            return;
        }

        const activatedExtension = await gitExtension.activate();
        const gitAPI = activatedExtension.getAPI(1);

        vscode.window.showWarningMessage(gitAPI.repositories[0]);
        const repository = gitAPI.repositories[0];

        let lastCommitHash: string | undefined;
        
        if (!repository) {
            vscode.window.showWarningMessage('Не удалось определить repository');
            return;
        }

        repository.state.onDidChange(() => {
        lastCommitHash = repository.state.HEAD?.commit ?? 'No commits yet';

        renderFrame();
        });

        // 64ffbcd066d4729c2d834494b648d33881999564
        // 64ffbcd066d4729c2d834494b648d33881999564   

        const head = repository.state.HEAD;


        if (head && head.commit) {
            lastCommitHash = head.commit;
        } else {
            vscode.window.showWarningMessage('Не удалось определить хеш (возможно, в репозитории еще нет коммитов).');
            return;
        }

        const writeEmitter = new vscode.EventEmitter<string>();

        const frames: string[][] = [
            [
                ' $ claude                                 ',
                '                                          ',
                '   ✻ Welcome to Claude Code!              ',
                '                                          ',
                '        ▐▛███▜▌                           ',
                '       ▝▜█████▛▘                          ',
                '         ▘▘ ▝▝                            ',
                '                                          ',
                ' > last commit hash: ' + (lastCommitHash || 'N/A') + '  ',
            ],
            [
                ' $ claude                                 ',
                '                                          ',
                '   ✻ Welcome to Claude Code!              ',
                '                                          ',
                '        ▐█████▌                           ',
                '       ▝▜█████▛▘                          ',
                '         ▘▘ ▝▝                            ',
                '                                          ',
                ' > last commit hash: ' + (lastCommitHash || 'N/A') + '  ',
            ],
			[
                ' $ claude                                 ',
                '                                          ',
                '   ✻ Welcome to Claude Code!              ',
                '                                          ',
                '        ▐▛███▜▌                           ',
                '       ▝▜█████▛▘                          ',
                '         ▘▘ ▝▝                            ',
                '                                          ',
                ' > last commit hash: ' + (lastCommitHash || 'N/A') + '  ',
            ],
        ];

		let frameIndex = 0;
        let timer: NodeJS.Timeout | undefined;

        const renderFrame = () => {
    	let output = '\x1b[H';

        lastCommitHash = repository.state.HEAD?.commit ?? 'No commits yet';

    	for (const line of frames[frameIndex]) {
    		    output += line.padEnd(44, ' ') + '\r\n';
    		}
    		writeEmitter.fire(output);
    		frameIndex = (frameIndex + 1) % frames.length;
		};

        const pty: vscode.Pseudoterminal = {
            onDidWrite: writeEmitter.event,
            open: () => {
                renderFrame();
                timer = setInterval(renderFrame, 500);
            },
            close: () => {
                if (timer) {
                    clearInterval(timer);
                    timer = undefined;
                }
            },
        };

        const terminal = vscode.window.createTerminal({
            name: 'Claudik Terminal',
            pty,
        });
        terminal.show();
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
