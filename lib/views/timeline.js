export function renderTimeline(steps, options = {}) {
  if (!steps || steps.length === 0) return '<p class="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">タイムライン情報がありません</p>';

  // 最大時間（外部指定があれば優先。ただし工程の最大終了時刻は必ず含む）
  const actualMax = Math.max(...steps.map(s => s.timeline?.end || 0));
  const overrideMax = Number.isFinite(options.maxTime) ? Number(options.maxTime) : 0;
  const maxTime = Math.max(actualMax, overrideMax);
  if (maxTime === 0) return '<p class="text-gray-500 text-center py-8 bg-gray-50 rounded-lg">タイムライン情報がありません</p>';

  const conflicts = options.conflicts || [];
  const rowReorder = !!options.rowReorder;

  // 時間軸の目盛りを生成
  const timeMarks = [];
  const interval = maxTime <= 30 ? 5 : maxTime <= 60 ? 10 : 15;
  for (let i = 0; i <= maxTime; i += interval) {
    timeMarks.push(i);
  }

  // ステップの色を定義
  const stepColors = [
    'bg-blue-500',
    'bg-green-500', 
    'bg-orange-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-gray-500'
  ];

  const timelineHTML = `
    <div class="bg-white rounded-lg shadow-sm p-6">
      <h2 class="text-xl font-semibold mb-4">タイムライン</h2>
      
      <!-- Time Scale -->
      <div class="relative mb-4">
        <div class="flex justify-between text-xs text-gray-500 mb-2">
          ${timeMarks.map(mark => `<span>${mark}分</span>`).join('')}
        </div>
        <div class="relative h-2 bg-gray-200 rounded">
          <!-- Time grid lines -->
          ${timeMarks.map(mark => {
            const position = (mark / maxTime) * 100;
            return `<div class="absolute top-0 bottom-0 w-px bg-gray-300" style="left: ${position}%"></div>`;
          }).join('')}
          <!-- Conflict overlays -->
          ${conflicts.map(c => {
            const left = (c.start / maxTime) * 100;
            const width = ((c.end - c.start) / maxTime) * 100;
            return `<div class=\"absolute inset-y-0 bg-red-400/40\" style=\"left:${left}%; width:${width}%\"></div>`;
          }).join('')}
        </div>
      </div>

      <!-- Timeline Steps -->
      <div class="space-y-3">
        ${steps.filter(s => s.timeline).map((step, index) => {
          const color = stepColors[index % stepColors.length];
          const startPercent = (step.timeline.start / maxTime) * 100;
          const widthPercent = ((step.timeline.end - step.timeline.start) / maxTime) * 100;
          
          return `
            <div class="relative tl-row" data-step-id="${step.id}">
              <div class="flex items-center gap-2">
                ${rowReorder ? `<div class=\"w-6 h-8 flex items-center justify-center text-gray-500 bg-gray-100 rounded tl-row-handle select-none cursor-grab\" data-step-id=\"${step.id}\" draggable=\"true\" title=\"行をドラッグで並べ替え\">≡</div>` : ''}
                <div class="flex-1">
                  <div class="relative">
                    <div class="h-8 bg-gray-200 rounded relative overflow-hidden">
                      <div 
                        class="tl-step-bar absolute top-0 left-0 h-full ${color} opacity-70 rounded cursor-grab select-none z-10"
                        data-step-id="${step.id}"
                        style="left: ${startPercent}%; width: ${widthPercent}%; touch-action: none;"
                      ></div>
                      <div class="absolute inset-0 flex items-center px-3 pointer-events-none z-0 select-none">
                        <span class="font-medium text-gray-700">
                          ${step.label || step.id}
                        </span>
                        <span class="tl-time ml-auto text-sm text-gray-600" data-step-id="${step.id}">
                          ${step.timeline.start}-${step.timeline.end}分
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Step Details (Collapsible) -->
      <div class="mt-6 pt-4 border-t border-gray-200">
        <button onclick="toggleStepDetails()" class="flex items-center justify-between w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded p-2 hover:bg-gray-50 transition-colors">
          <h3 class="text-lg font-medium text-gray-800">ステップ詳細</h3>
          <svg id="step-details-chevron" class="w-5 h-5 text-gray-500 transform transition-transform duration-200" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
          </svg>
        </button>
        <div id="step-details-content" class="mt-3 space-y-3 hidden">
          ${steps.filter(s => s.timeline).map((step, index) => {
            const color = stepColors[index % stepColors.length];
            
            const reqText = step.req ? Object.entries(step.req).map(([key, value]) => {
              const reqLabels = {
                'stove': 'コンロ',
                'hands': '手作業',
                'oven': 'オーブン'
              };
              return `${reqLabels[key] || key}: ${value}`;
            }).join(', ') : '';

            return `
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div class="w-4 h-4 rounded-full ${color} mt-1 flex-shrink-0"></div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="font-medium text-gray-800">${step.label || step.id}</h4>
                    <div class="text-sm text-gray-500">
                      ${step.timeline.start}-${step.timeline.end}分 (${step.time}分間)
                    </div>
                  </div>
                  ${step.instructions ? `<p class="text-gray-700 text-sm mb-2">${step.instructions}</p>` : ''}
                  ${reqText ? `
                    <div class="text-xs text-gray-600">
                      <span class="font-medium">必要なもの:</span> ${reqText}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  return timelineHTML;
}

// ステップ詳細の折りたたみ機能
export function setupTimelineInteractions() {
  window.toggleStepDetails = function() {
    const content = document.getElementById('step-details-content');
    const chevron = document.getElementById('step-details-chevron');
    
    if (content && chevron) {
      const isHidden = content.classList.contains('hidden');
      
      if (isHidden) {
        content.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)';
      }
    }
  };
}
