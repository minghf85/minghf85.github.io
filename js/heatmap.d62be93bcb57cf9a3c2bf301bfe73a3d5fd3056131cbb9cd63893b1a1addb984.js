document.addEventListener('DOMContentLoaded', function() {
  // 首先通过fetch API获取外部JSON数据
  fetchPostsData()
    .then(postsData => {
      // 隐藏加载提示
      const loadingElement = document.getElementById('heatmap-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      // 如果成功获取数据，渲染热力图
      renderHeatmap(postsData);
    })
    .catch(error => {
      console.error('获取文章数据失败:', error);
      // 显示错误信息
      const loadingElement = document.getElementById('heatmap-loading');
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }
      
      const errorElement = document.getElementById('heatmap-error');
      if (errorElement) {
        errorElement.style.display = 'block';
      }
    });
});

// 获取文章数据的函数
async function fetchPostsData() {
  try {
    // 添加缓存破坏参数，防止缓存
    const timestamp = new Date().getTime();
    const url = `${siteIndexURL}?_=${timestamp}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 适配外部JSON格式，提取文章数据
    let articles = [];
    if (data.articles) {
      // 新的JSON格式
      articles = data.articles;
    } else if (Array.isArray(data)) {
      // 如果直接是数组格式
      articles = data;
    } else {
      console.error('未知的JSON格式', data);
      throw new Error('未知的JSON格式');
    }
    
    // 处理并格式化文章数据
    return articles.map(article => ({
      title: article.title || '无标题',
      date: article.date || new Date().toISOString().split('T')[0],
      wordCount: article.wordCount || 0,
      permalink: article.url || article.permalink || '#'
    })).filter(article => article.date && article.wordCount > 0);
  } catch (error) {
    console.error('获取或处理文章数据时出错:', error);
    throw error;
  }
}

// 渲染热力图的函数
function renderHeatmap(postsData) {
  // 获取当前年份
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  
  // 创建一个完整年份的日期映射
  const startDate = new Date(currentYear, 0, 1); // 1月1日
  const endDate = new Date(currentYear, 11, 31); // 12月31日
  
  // 确保startDate是周日开始
  while (startDate.getDay() !== 0) {
    startDate.setDate(startDate.getDate() - 1);
  }
  
  // 创建日期到文章数据的映射
  const postsByDate = {};
  postsData.forEach(post => {
    try {
      const postDate = post.date.split('T')[0];
      if (!postsByDate[postDate]) {
        postsByDate[postDate] = [];
      }
      postsByDate[postDate].push(post);
    } catch (e) {
      console.log('跳过无效日期的文章:', post.title);
    }
  });
  
  // 获取所有文章的字数统计，用于计算热力图等级
  const wordCounts = postsData.map(post => post.wordCount);
  const maxWordCount = Math.max(...wordCounts, 1);
  
  // 计算热力图等级的阈值
  function getHeatLevel(wordCount) {
    if (wordCount === 0) return 0;
    
    const percentage = wordCount / maxWordCount;
    if (percentage < 0.2) return 1;
    if (percentage < 0.4) return 2;
    if (percentage < 0.7) return 3;
    return 4;
  }
  
  // 生成整年的日期格子
  const heatmapGrid = document.getElementById('heatmap-grid');
  if (!heatmapGrid) {
    console.error('找不到热力图网格元素');
    return;
  }
  
  // 清空网格内容
  heatmapGrid.innerHTML = '';
  
  // 按周组织数据
  const weeks = [];
  let currentWeek = [];
  let currentDateIterator = new Date(startDate);
  
  // 生成所有日期的格子，按周组织
  while (currentDateIterator <= endDate || currentWeek.length > 0) {
    if (currentDateIterator.getDay() === 0 && currentWeek.length > 0) {
      // 一周结束，保存这一周
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    if (currentDateIterator <= endDate) {
      const dateStr = currentDateIterator.toISOString().split('T')[0];
      currentWeek.push({
        date: new Date(currentDateIterator),
        dateStr: dateStr,
        isCurrentYear: currentDateIterator.getFullYear() === currentYear,
        postsOnDay: postsByDate[dateStr] || []
      });
      
      // 移动到下一天
      currentDateIterator.setDate(currentDateIterator.getDate() + 1);
    } else if (currentWeek.length > 0) {
      // 添加空白日期以完成最后一周
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  // 将每周的数据渲染为格子，确保每列是一周（从上到下排列）
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex];
    
    // 创建7天的格子（周日到周六）
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      // 创建一个格子
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      
      // 记录格子位置，用于确定工具提示方向
      cell.setAttribute('data-row', dayOfWeek);
      cell.setAttribute('data-col', weekIndex);
      
      // 找到当前周的这一天
      const day = week.find(d => d.date.getDay() === dayOfWeek);
      
      if (day) {
        const dateFormatted = day.date.toLocaleDateString('zh-CN');
        
        // 为格子设置日期属性
        cell.setAttribute('data-date', day.dateStr);
        
        if (day.isCurrentYear) {
          const totalWordsOnDay = day.postsOnDay.reduce((sum, post) => sum + post.wordCount, 0);
          const level = getHeatLevel(totalWordsOnDay);
          
          cell.setAttribute('data-level', level.toString());
          
          // 创建工具提示
          const tooltip = document.createElement('div');
          tooltip.className = 'heatmap-tooltip';
          
          // 根据格子的行位置决定工具提示显示方向
          if (dayOfWeek < 3) {
            tooltip.style.bottom = 'auto';
            tooltip.style.top = '100%';
            tooltip.style.marginTop = '5px';
            tooltip.style.marginBottom = '0';
          } else {
            tooltip.style.top = 'auto';
            tooltip.style.bottom = '100%';
            tooltip.style.marginBottom = '5px';
            tooltip.style.marginTop = '0';
          }
          
          if (day.postsOnDay.length > 0) {
            // 如果有文章，显示文章信息
            const postsInfo = day.postsOnDay.map(post => `${post.title} (${post.wordCount} 字)`).join('<br>');
            tooltip.innerHTML = `
              <strong>${dateFormatted}</strong><br>
              ${totalWordsOnDay} 字共 ${day.postsOnDay.length} 篇文章<br>
              ${postsInfo}
            `;
            
            // 添加点击事件
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', function() {
              if (day.postsOnDay.length === 1) {
                window.location.href = day.postsOnDay[0].permalink;
              }
            });
          } else {
            // 如果没有文章，只显示日期
            tooltip.innerHTML = `<strong>${dateFormatted}</strong><br>无文章`;
          }
          
          cell.appendChild(tooltip);
        } else {
          // 非当前年份的日期使用较浅的背景色
          cell.setAttribute('data-level', '0');
          cell.style.opacity = '0.5';
          
          // 为非当年的日期也添加工具提示
          const tooltip = document.createElement('div');
          tooltip.className = 'heatmap-tooltip';
          tooltip.innerHTML = `<strong>${dateFormatted}</strong>`;
          cell.appendChild(tooltip);
        }
      } else {
        // 填充空白格子
        cell.setAttribute('data-level', '0');
        cell.style.opacity = '0.2';
      }
      
      heatmapGrid.appendChild(cell);
    }
  }
  
  // 调整月份标签位置
  adjustMonthLabels();
  
  // 根据容器宽度调整热力图大小
  const containerWidth = document.querySelector('.heatmap-wrapper').clientWidth;
  adjustHeatmapSize(containerWidth);
}

// 重写月份标签位置计算函数
function adjustMonthLabels() {
  const heatmapGrid = document.getElementById('heatmap-grid');
  const monthsContainer = document.querySelector('.heatmap-months');
  
  if (!heatmapGrid || !monthsContainer) return;

  // 清除旧的月份标签内容
  monthsContainer.innerHTML = '';
  
  // 获取热力图网格的计算样式
  const gridComputedStyle = window.getComputedStyle(heatmapGrid);
  
  // 获取格子和间隙的大小
  const cellSize = parseInt(gridComputedStyle.gridTemplateColumns.split(' ')[0]) || 14;
  const cellGap = parseInt(gridComputedStyle.columnGap || gridComputedStyle.gridColumnGap || gridComputedStyle.gridGap) || 4;
  
  // 星期标签的宽度
  const daysWidth = 30; // 星期标签所占宽度
  
  // 获取当前年份
  const currentYear = new Date().getFullYear();
  
  // 月份名称数组
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                     '七月', '八月', '九月', '十月', '十一', '十二'];
  
  // 计算每个月1号的列位置
  const monthColumns = calculateMonthColumns(currentYear, heatmapGrid);
  
  // 为每个月份创建标签并设置位置
  for (let month = 0; month < 12; month++) {
    if (monthColumns[month] !== undefined) {
      const span = document.createElement('span');
      span.textContent = monthNames[month];
      span.setAttribute('data-month', month);
      
      // 计算该月标签的水平位置，加上星期标签的宽度
      const leftOffset = monthColumns[month] * (cellSize + cellGap) + daysWidth;
      span.style.left = leftOffset + 'px';
      
      monthsContainer.appendChild(span);
    }
  }
}

// 计算每个月1号在热力图中的列位置
function calculateMonthColumns(year, heatmapGrid) {
  const monthColumns = {};
  const cells = heatmapGrid.querySelectorAll('.heatmap-cell');
  
  // 遍历所有格子查找每个月的1号
  for (let i = 0; i < cells.length; i++) {
    const dateStr = cells[i].getAttribute('data-date');
    if (dateStr) {
      const date = new Date(dateStr);
      
      // 检查是否为当前年份且是当月1号
      if (date.getFullYear() === year && date.getDate() === 1) {
        // 计算这个格子在第几列（每7个格子是一列）
        const column = Math.floor(i / 7);
        const month = date.getMonth();
        
        monthColumns[month] = column;
      }
    }
  }
  
  return monthColumns;
}

// 修改调整热力图大小的函数，根据容器宽度自适应调整
function adjustHeatmapSize(containerWidth) {
  const heatmapGrid = document.getElementById('heatmap-grid');
  const heatmapDays = document.querySelector('.heatmap-days');
  
  if (!heatmapGrid || !heatmapDays) return;
  
  // 计算可用宽度（减去星期标签的宽度）
  const availableWidth = containerWidth - 30; // 30px是星期标签宽度
  
  // 计算每个格子的大小，总共需要放53列（每周一列，一年大约53周）
  // 考虑了间隙大小，确保全部在容器内显示
  let cellGap;
  
  if (containerWidth < 600) {
    cellGap = 2;
  } else if (containerWidth < 900) {
    cellGap = 3;
  } else {
    cellGap = 4;
  }
  
  // 计算适合的格子大小
  // 公式：(availableWidth - (52 * cellGap)) / 53
  let cellSize = Math.floor((availableWidth - (52 * cellGap)) / 53);
  
  // 设置最小和最大格子大小限制
  cellSize = Math.max(5, Math.min(14, cellSize));
  
  // 设置热力图网格的样式
  heatmapGrid.style.gridTemplateRows = `repeat(7, ${cellSize}px)`;
  heatmapGrid.style.gridTemplateColumns = `repeat(53, ${cellSize}px)`;
  heatmapGrid.style.gridGap = `${cellGap}px`;
  
  // 更新星期标签的布局
  heatmapDays.style.height = `calc(7 * ${cellSize}px + 6 * ${cellGap}px)`;
  
  // 更新所有格子的尺寸
  const cells = heatmapGrid.querySelectorAll('.heatmap-cell');
  cells.forEach(cell => {
    cell.style.width = `${cellSize}px`;
    cell.style.height = `${cellSize}px`;
  });
  
  // 重新调整月份标签位置
  adjustMonthLabels();
}

// 简化resize事件监听器
window.addEventListener('resize', function() {
  const containerWidth = document.querySelector('.heatmap-wrapper').clientWidth;
  adjustHeatmapSize(containerWidth);
});
