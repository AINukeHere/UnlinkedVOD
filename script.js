// RDF 데이터 불러오기 및 시각화
const store = $rdf.graph(); // RDF 그래프 생성
const fetcher = $rdf.fetcher(store); // 데이터 가져오기

// RDF 파일 불러오기
fetch('http://localhost:5500/data.ttl')  // 절대 URI로 RDF 파일 경로 설정
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text();  // 응답을 텍스트 형식으로 변환
    })
    .then(turtleData => {
        // RDF 데이터를 파싱하여 시각화 실행
        const graphData = parseRDF(turtleData); // 파싱 함수 호출
        visualizeGraph(graphData); // D3.js 시각화 함수 호출
    })
    .catch(error => {
        console.error('Error loading RDF data:', error);
    });

// RDF 데이터 파싱 함수
function parseRDF(turtleData) {
    const nodes = [];
    const links = [];

    const store = $rdf.graph();
    $rdf.parse(turtleData, store, 'http://example.org/', 'text/turtle');

    store.statements.forEach(statement => {
        const subject = statement.subject.value;
        const predicate = statement.predicate.value;
        const object = statement.object.value;

        // 노드 추가 (타입 정보 포함)
        if (!nodes.some(node => node.id === subject)) {
            const subjectType = store.any(statement.subject, $rdf.sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"));
            const nodeType = subjectType ? subjectType.value.split('/').pop() : "Unknown";
            nodes.push({ id: subject, title: subject.split('/').pop(), type: nodeType });
        }
        if (!nodes.some(node => node.id === object)) {
            const objectType = store.any(statement.object, $rdf.sym("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"));
            const nodeType = objectType ? objectType.value.split('/').pop() : "Unknown";
            nodes.push({ id: object, title: object.split('/').pop(), type: nodeType });
        }

        // 링크 추가: 서술어를 type으로 설정
        links.push({ source: subject, target: object, type: predicate.split('/').pop() });
    });

    return { nodes, links };
}

function visualizeGraph(graphData) {
    const width = 800;
    const height = 600;

    const svg = d3.select('svg')
        .attr('width', width)
        .attr('height', height);

    const color = d3.scaleOrdinal()
        .domain(['Streamer', 'VOD', 'Unknown'])
        .range(['#1f77b4', '#ff7f0e', '#d62728']); // 각 타입에 맞는 색상 설정

    const simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2));

    // 링크 (연결선)
    const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(graphData.links)
        .enter().append('line')
        .attr('stroke-width', 2)
        .attr('stroke', '#999');

    // 연결선 위에 서술어 텍스트 추가
    const linkLabels = svg.append('g')
        .attr('class', 'link-labels')
        .selectAll('text')
        .data(graphData.links)
        .enter().append('text')
        .attr('class', 'link-label')
        .attr('font-size', '10px')
        .attr('fill', '#555')
        .text(d => d.type);

    // 노드
    const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(graphData.nodes)
        .enter().append('circle')
        .attr('r', 10)
        .attr('fill', d => color(d.type))  // 노드의 타입에 따라 색상 적용
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    node.append('title')
        .text(d => d.title);

    simulation
        .nodes(graphData.nodes)
        .on('tick', ticked);

    simulation.force('link')
        .links(graphData.links);

    // tick() 호출 시 위치 업데이트
    function ticked() {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        // 링크 레이블의 위치를 업데이트
        linkLabels
            .attr('x', d => (d.source.x + d.target.x) / 2)  // 연결선의 중간 위치
            .attr('y', d => (d.source.y + d.target.y) / 2);
    }

    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}
