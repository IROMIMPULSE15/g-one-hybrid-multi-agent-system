/**
 * Quick Pinecone Status Check
 */

import { config } from 'dotenv'
config()

async function quickCheck() {
    console.log('\n🔍 Pinecone Quick Status Check\n')
    console.log('='.repeat(50))

    // 1. Check API Key
    const apiKey = process.env.PINECONE_API_KEY
    console.log('✅ API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : '❌ NOT SET')

    // 2. Check Index Name
    const indexName = process.env.PINECONE_INDEX || process.env.PINECONE_INDEX_NAME
    console.log('✅ Index Name:', indexName || '❌ NOT SET')

    // 3. Test Connection
    if (!apiKey) {
        console.log('\n❌ Cannot test connection - API key missing')
        return
    }

    try {
        const { Pinecone } = await import('@pinecone-database/pinecone')
        const pc = new Pinecone({ apiKey })

        console.log('✅ Pinecone SDK loaded')

        // Try to list indexes
        try {
            const indexes = await pc.listIndexes()
            console.log(`✅ Connection successful - Found ${indexes.indexes?.length || 0} indexes`)

            if (indexes.indexes && indexes.indexes.length > 0) {
                console.log('\n📊 Available Indexes:')
                indexes.indexes.forEach((idx: any) => {
                    console.log(`   - ${idx.name} (${idx.dimension}D, ${idx.metric})`)
                })
            }

            // Check if our index exists
            if (indexName) {
                const ourIndex = indexes.indexes?.find((idx: any) => idx.name === indexName)
                if (ourIndex) {
                    console.log(`\n✅ Your index "${indexName}" is ready to use!`)
                    console.log(`   Dimension: ${ourIndex.dimension}`)
                    console.log(`   Metric: ${ourIndex.metric}`)
                    console.log(`   Status: ${ourIndex.status?.ready ? 'Ready' : 'Not Ready'}`)
                } else {
                    console.log(`\n⚠️  Index "${indexName}" not found in your Pinecone account`)
                    console.log('   Available indexes:', indexes.indexes?.map((i: any) => i.name).join(', '))
                }
            }

        } catch (err: any) {
            console.log('❌ Failed to list indexes:', err.message)
        }

    } catch (err: any) {
        console.log('❌ Connection failed:', err.message)
    }

    console.log('='.repeat(50))
    console.log('\n')
}

quickCheck()
